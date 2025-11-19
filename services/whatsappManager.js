
// services/whatsappManager.js (Versão 2.9.3 - QR Watchdog)
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

let genAI;
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (error) {
        logger.error("Erro ao inicializar Gemini:", error);
    }
}

const sessions = {};
let wss;
const pausedChats = {};

function setWss(webSocketServer) { wss = webSocketServer; }

function broadcastEvent(event) {
    if (!wss) return;
    const data = JSON.stringify(event);
    wss.clients.forEach(client => { if (client.readyState === client.OPEN) client.send(data); });
}

function runRuleBasedEngine(message, sessionId) {
    const logicDir = path.join("uploads", sessionId);
    if (!fs.existsSync(logicDir)) return { handled: false };
    const files = fs.readdirSync(logicDir);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (!jsonFile) return { handled: false };

    try {
        const filePath = path.join(logicDir, jsonFile);
        const logicData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const userMessage = message.body.toLowerCase().trim();

        for (const rule of logicData.rules) {
            const foundKeyword = rule.keywords.find(keyword => userMessage.includes(keyword.toLowerCase()));
            if (foundKeyword) {
                logger.log(`[${sessionId}] Regra encontrada para keyword: "${foundKeyword}"`);
                return {
                    handled: true,
                    reply: rule.reply,
                    shouldPause: rule.pause_bot_after_reply === true,
                    image_url: rule.image_url || null
                };
            }
        }
        if (logicData.default_reply) {
            const txtFile = files.find(f => f.endsWith(".txt"));
            if (!txtFile) {
                 return { handled: true, reply: logicData.default_reply, shouldPause: false, image_url: null };
            }
        }
    } catch (error) {
        logger.error(`[${sessionId}] Erro ao processar regras JSON:`, error);
    }
    return { handled: false };
}

function createSession(sessionId) {
    if (sessions[sessionId] && sessions[sessionId].status !== "DESTROYING") {
        return;
    }

    logger.log(`[WhatsappManager] Iniciando sessão: ${sessionId}`);
    
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote", "--disable-gpu"]
        }
    });

    sessions[sessionId] = { client, status: "INITIALIZING", qrCode: null, qrAttempts: 0 };
    pausedChats[sessionId] = [];
    broadcastEvent({ type: "status_update", sessionId, status: "INITIALIZING" });

    // --- WATCHDOG DO QR CODE ---
    // Se em 40 segundos não tiver conectado ou gerado QR, reinicia
    const qrTimeout = setTimeout(() => {
        if (sessions[sessionId] && sessions[sessionId].status === "INITIALIZING") {
            logger.warn(`[${sessionId}] Watchdog: QR Code demorou muito. Reiniciando...`);
            destroySession(sessionId).then(() => createSession(sessionId));
        }
    }, 40000);

    client.on("qr", (qr) => {
        clearTimeout(qrTimeout); // QR chegou, cancela watchdog
        logger.log(`[${sessionId}] QR Code gerado.`);
        sessions[sessionId].status = "QR_PENDING";
        qrcode.toDataURL(qr, (err, url) => { 
            if (!err) {
                sessions[sessionId].qrCode = url;
                broadcastEvent({ type: "status_update", sessionId, status: "QR_PENDING", qrCode: url });
            }
        });
    });

    client.on("ready", () => {
        clearTimeout(qrTimeout); // Conectou, cancela watchdog
        logger.log(`[${sessionId}] Cliente PRONTO (Conectado).`);
        sessions[sessionId].status = "READY";
        sessions[sessionId].qrCode = null;
        broadcastEvent({ type: "status_update", sessionId, status: "READY" });
    });

    client.on("auth_failure", (msg) => {
        clearTimeout(qrTimeout);
        logger.error(`[${sessionId}] Falha na autenticação:`, msg);
        sessions[sessionId].status = "ERROR";
        broadcastEvent({ type: "status_update", sessionId, status: "ERROR" });
    });

    client.on("disconnected", (reason) => {
        clearTimeout(qrTimeout);
        logger.warn(`[${sessionId}] Cliente desconectado:`, reason);
        if (sessions[sessionId]) sessions[sessionId].status = "DISCONNECTED";
        broadcastEvent({ type: "status_update", sessionId, status: "DISCONNECTED" });
        destroySession(sessionId);
    });

    client.on("message", async (message) => {
        const userNumber = message.from;
        if (userNumber.endsWith("@g.us") || message.isStatus || message.fromMe) return;

        const sessionPausedChats = pausedChats[sessionId] || [];
        const isPaused = sessionPausedChats.includes(userNumber);
        const userMessageLower = message.body.toLowerCase().trim();
        const unpauseKeywords = ["menu", "ajuda", "inicio", "voltar", "sair", "0"];

        if (isPaused) {
            if (unpauseKeywords.includes(userMessageLower)) {
                pausedChats[sessionId] = sessionPausedChats.filter(id => id !== userNumber);
                logger.log(`[${sessionId}] Chat ${userNumber} REATIVADO.`);
            } else {
                return;
            }
        }
        
        const ruleResult = runRuleBasedEngine(message, sessionId);
        if (ruleResult.handled) {
            broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });

            if (ruleResult.image_url) {
                try {
                    const media = await MessageMedia.fromUrl(ruleResult.image_url, { unsafeMime: true });
                    await client.sendMessage(userNumber, media, { caption: ruleResult.reply });
                    broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: `[Imagem] ${ruleResult.reply}`, timestamp: new Date().toISOString() });
                } catch (imgError) {
                    await message.reply(ruleResult.reply);
                    broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: ruleResult.reply, timestamp: new Date().toISOString() });
                }
            } else {
                await message.reply(ruleResult.reply);
                broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: ruleResult.reply, timestamp: new Date().toISOString() });
            }

            if (ruleResult.shouldPause) {
                if (!pausedChats[sessionId].includes(userNumber)) pausedChats[sessionId].push(userNumber);
            }
            return;
        }

        broadcastEvent({ type: "new_message", sessionId, from: userNumber, body: message.body, timestamp: new Date().toISOString() });
        
        try {
            if (!genAI) throw new Error("API do Gemini não configurada.");
            
            let knowledge = "";
            const logicDir = path.join("uploads", sessionId);
            if (fs.existsSync(logicDir)) {
                fs.readdirSync(logicDir).forEach(file => {
                    if (path.extname(file) === ".txt") knowledge += fs.readFileSync(path.join(logicDir, file), "utf8") + "\n\n";
                });
            }
            
            if (!knowledge && !ruleResult.handled) return; 

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const systemInstruction = `
                Você é um assistente virtual útil e amigável.
                Use APENAS o contexto abaixo para responder perguntas sobre a empresa/serviço.
                Se a resposta não estiver no contexto, diga educadamente que não sabe e sugira falar com um atendente.
                
                --- CONTEXTO ---
                ${knowledge}
                --- FIM DO CONTEXTO ---
            `;

            const result = await model.generateContent(`${systemInstruction}\n\nUsuário: ${message.body}`);
            const textResponse = result.response.text();

            await client.sendMessage(userNumber, textResponse);
            broadcastEvent({ type: "new_message", sessionId, from: "BOT", to: userNumber, body: textResponse, timestamp: new Date().toISOString() });
        } catch (error) {
            logger.error(`[${sessionId}] Erro Gemini:`, error);
        }
    });

    client.initialize().catch(err => {
        logger.error(`[${sessionId}] Erro init:`, err);
        sessions[sessionId].status = "ERROR";
        broadcastEvent({ type: "status_update", sessionId, status: "ERROR" });
    });
}

async function destroySession(sessionId) {
    if (sessions[sessionId]) {
        logger.log(`[WhatsappManager] Encerrando sessão: ${sessionId}`);
        sessions[sessionId].status = "DESTROYING";
        try {
            await sessions[sessionId].client.destroy();
        } catch(e) {
            logger.error(`Erro ao destruir cliente puppeteer para ${sessionId}`, e);
        }
        delete sessions[sessionId];
        delete pausedChats[sessionId];
    }
    
    const authPath = path.join(__dirname, "..", ".wwebjs_auth", `session-${sessionId}`);
    if (fs.existsSync(authPath)) {
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
            logger.log(`[WhatsappManager] Pasta de autenticação removida para: ${sessionId}`);
        } catch (err) {
            logger.error(`Erro ao remover pasta auth para ${sessionId}:`, err);
        }
    }

    broadcastEvent({ type: "session_destroyed", sessionId });
    return true;
}

const getSessionStatus = (sessionId) => sessions[sessionId]?.status || "OFFLINE";
const getQRCode = (sessionId) => sessions[sessionId]?.qrCode || null;
const getAllSessions = async () => {
    const db = require("./db");
    // Support both async (Firebase) and sync (Local) return types roughly
    const savedDevices = await Promise.resolve(db.getDevices()); 
    const activeDeviceIds = Object.keys(sessions);
    const allDeviceIds = [...new Set([...savedDevices, ...activeDeviceIds])];

    return allDeviceIds.map(id => ({
        id: id,
        status: sessions[id]?.status || "OFFLINE"
    }));
};

async function sendMessage(sessionId, number, text) {
    const client = sessions[sessionId]?.client;
    if (client && sessions[sessionId].status === "READY") {
        const chatId = number.includes("@") ? number : `${number.replace(/\D/g, "")}@c.us`;
        await client.sendMessage(chatId, text);
        broadcastEvent({ type: "new_message", sessionId, from: "ADMIN", to: chatId, body: text, timestamp: new Date().toISOString() });
        return true;
    }
    return false;
}

async function checkGeminiHealth() {
    if (!genAI) return { status: "ERROR", message: "API Key missing" };
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        await model.generateContent("ping");
        return { status: "OPERATIONAL" };
    } catch (error) {
        return { status: "ERROR", message: error.message };
    }
}

module.exports = { setWss, createSession, getSessionStatus, getQRCode, getAllSessions, destroySession, sendMessage, checkGeminiHealth };
