const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

let genAI;
if (process.env.GEMINI_API_KEY) {
    try { genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); } 
    catch (e) { logger.error("Erro Gemini", e); }
}

const sessions = {};
let wss;
const pausedChats = {};

function setWss(s) { wss = s; }
function broadcast(e) { if(wss) wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(e))); }

function runRules(msg, id) {
    const dir = path.join("uploads", id);
    if (!fs.existsSync(dir)) return { handled: false };
    const f = fs.readdirSync(dir).find(x => x.endsWith(".json"));
    if (!f) return { handled: false };
    
    try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        const txt = msg.body.toLowerCase();
        for (const r of data.rules) {
            if (r.keywords.some(k => txt.includes(k.toLowerCase()))) {
                return { handled: true, reply: r.reply, pause: r.pause_bot_after_reply, img: r.image_url };
            }
        }
        if (data.default_reply && !fs.readdirSync(dir).some(x => x.endsWith(".txt"))) {
             return { handled: true, reply: data.default_reply, pause: false };
        }
    } catch (e) { logger.error(`[${id}] Erro JSON`, e); }
    return { handled: false };
}

function createSession(id) {
    if (sessions[id] && sessions[id].status !== 'DESTROYING') return;
    logger.log(`[Bot] Iniciando ${id}`);
    
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: id }),
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }
    });
    
    sessions[id] = { client, status: "INITIALIZING", qr: null };
    pausedChats[id] = [];
    broadcast({ type: "status_update", sessionId: id, status: "INITIALIZING" });

    // Watchdog
    const timer = setTimeout(() => {
        if (sessions[id] && sessions[id].status === "INITIALIZING") {
            logger.warn(`[${id}] QR demorou. Reiniciando.`);
            destroySession(id).then(() => createSession(id));
        }
    }, 40000);

    client.on("qr", (qr) => {
        clearTimeout(timer);
        sessions[id].status = "QR_PENDING";
        qrcode.toDataURL(qr, (e, url) => {
            if (!e) {
                sessions[id].qr = url;
                broadcast({ type: "status_update", sessionId: id, status: "QR_PENDING", qrCode: url });
            }
        });
    });

    client.on("ready", () => {
        clearTimeout(timer);
        sessions[id].status = "READY";
        sessions[id].qr = null;
        broadcast({ type: "status_update", sessionId: id, status: "READY" });
    });

    client.on("disconnected", () => {
        clearTimeout(timer);
        sessions[id].status = "DISCONNECTED";
        broadcast({ type: "status_update", sessionId: id, status: "DISCONNECTED" });
        destroySession(id);
    });

    client.on("message", async (msg) => {
        const from = msg.from;
        if (from.endsWith("@g.us") || msg.isStatus || msg.fromMe) return;
        
        // Unpause logic
        if (pausedChats[id].includes(from)) {
            if (["menu", "voltar", "0"].includes(msg.body.toLowerCase().trim())) {
                pausedChats[id] = pausedChats[id].filter(x => x !== from);
                await client.sendMessage(from, "Bot reativado.");
            }
            return;
        }

        const rule = runRules(msg, id);
        if (rule.handled) {
            broadcast({ type: "new_message", sessionId: id, from, body: msg.body });
            if (rule.img) {
                try {
                    const m = await MessageMedia.fromUrl(rule.img, { unsafeMime: true });
                    await client.sendMessage(from, m, { caption: rule.reply });
                } catch { await msg.reply(rule.reply); }
            } else {
                await msg.reply(rule.reply);
            }
            broadcast({ type: "new_message", sessionId: id, from: "BOT", to: from, body: rule.reply });
            if (rule.pause) pausedChats[id].push(from);
            return;
        }

        // Gemini
        try {
            if (!genAI) return;
            broadcast({ type: "new_message", sessionId: id, from, body: msg.body });
            
            let context = "";
            const dir = path.join("uploads", id);
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).filter(f => f.endsWith(".txt")).forEach(f => {
                    context += fs.readFileSync(path.join(dir, f), "utf8") + "\n";
                });
            }
            if (!context) return;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const res = await model.generateContent(`Contexto:\n${context}\n\nRespnda ao usuário: ${msg.body}`);
            const txt = res.response.text();
            await client.sendMessage(from, txt);
            broadcast({ type: "new_message", sessionId: id, from: "BOT", to: from, body: txt });
        } catch (e) { logger.error("Erro Gemini", e); }
    });

    client.initialize().catch(() => {
        sessions[id].status = "ERROR";
        broadcast({ type: "status_update", sessionId: id, status: "ERROR" });
    });
}

async function destroySession(id) {
    if (sessions[id]) {
        sessions[id].status = "DESTROYING";
        try { await sessions[id].client.destroy(); } catch {}
        delete sessions[id];
    }
    const p = path.join(__dirname, "..", ".wwebjs_auth", `session-${id}`);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    broadcast({ type: "session_destroyed", sessionId: id });
    return true;
}

async function sendMessage(id, to, txt) {
    if (sessions[id] && sessions[id].status === "READY") {
        const dest = to.includes("@") ? to : `${to.replace(/\D/g,"")}@c.us`;
        await sessions[id].client.sendMessage(dest, txt);
        broadcast({ type: "new_message", sessionId: id, from: "ADMIN", to: dest, body: txt });
        return true;
    }
    return false;
}

const getQRCode = (id) => sessions[id]?.qr;
const getAllSessions = () => {
    const saved = require("./db").getDevices();
    const active = Object.keys(sessions);
    const all = [...new Set([...saved, ...active])];
    return all.map(id => ({ id, status: sessions[id]?.status || "OFFLINE" }));
};
const checkGeminiHealth = async () => {
    if(!genAI) return { status: "ERROR" };
    try { await genAI.getGenerativeModel({model:"gemini-2.5-flash"}).generateContent("ping"); return {status: "OPERATIONAL"}; }
    catch(e) { return { status: "ERROR", msg: e.message }; }
};

module.exports = { setWss, createSession, destroySession, getQRCode, getAllSessions, sendMessage, checkGeminiHealth };