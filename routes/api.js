
// routes/api.js
const express = require("express");
const router = express.Router();
const whatsappManager = require("../services/whatsappManager");
const db = require("../services/db");
const { logger } = require("../services/logger");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const JWT_SECRET = process.env.JWT_SECRET || "changeme_in_prod_please";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join("uploads", req.params.sessionId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => { cb(null, file.originalname); }
});
const upload = multer({ storage });

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (req.path === '/login' || req.path === '/auth/register') return next();
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// --- Auth & User Info ---
router.get("/auth/me", authenticateToken, async (req, res) => {
    try {
        const users = await db.getUsers();
        const searchName = req.user.user.toLowerCase();
        
        const user = users.find(u => 
            u.email.toLowerCase() === searchName || 
            u.name.toLowerCase() === searchName
        );
        
        if (user) {
            const { password, ...safeUser } = user;
            res.json(safeUser);
        } else {
            if (req.user.role === 'admin') {
                 res.json({ name: 'Admin (Legacy)', email: 'admin@chatbot.com', role: 'admin', plan: 'prod_TSBFAZOMsCNIAT' });
            } else {
                 res.status(404).json({ error: "Usuário não encontrado" });
            }
        }
    } catch (e) {
        logger.error("Erro em /auth/me", e);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await db.findUser(username, password);
        
        if (user) {
            const token = jwt.sign({ user: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            logger.log(`Login efetuado: ${user.name}`);
            return res.status(200).json({ success: true, token, user: { name: user.name, email: user.email, role: user.role, plan: user.plan } });
        }

        logger.warn(`Falha login: ${username}`);
        res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });
    } catch (e) {
        logger.error("Erro login", e);
        res.status(500).json({ success: false, message: "Erro servidor" });
    }
});

router.post("/auth/register", async (req, res) => {
    const { name, email, password, plan } = req.body;
    logger.log(`Tentativa de registro: ${name} (${email})`);

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
        const users = await db.getUsers();
        const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: "Email já cadastrado" });
        }

        const newUser = await db.addUser({ 
            name, 
            email, 
            password, 
            role: 'client',
            plan: plan ? plan.id : 'plan_free'
        });
        
        const token = jwt.sign({ user: newUser.name, role: 'client' }, JWT_SECRET, { expiresIn: '24h' });
        logger.log(`Registro com sucesso: ${name}`);
        
        res.status(201).json({ success: true, token, user: newUser });
    } catch (err) {
        logger.error("Erro ao salvar usuário:", err);
        res.status(500).json({ error: "Erro interno ao salvar usuário." });
    }
});

// --- Users Management (Admin) ---
router.get("/users", authenticateToken, async (req, res) => {
    try {
        const users = await db.getUsers();
        res.json(users.map(u => { const {password, ...rest} = u; return rest; }));
    } catch (e) {
        res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

router.post("/users", authenticateToken, async (req, res) => {
    const { name, email, role } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Nome e Email obrigatórios" });
    try {
        const newUser = await db.addUser({ name, email, role: role || 'client', password: '123' });
        logger.log(`Usuário adicionado manualmente: ${name}`);
        res.status(201).json(newUser);
    } catch(e) { res.status(500).json({error: "Erro DB"}); }
});

router.delete("/users/:id", authenticateToken, async (req, res) => {
    const success = await db.removeUser(req.params.id);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Usuário não encontrado" });
    }
});

// --- Dashboard ---
router.get("/health/gemini", async (req, res) => {
    const health = await whatsappManager.checkGeminiHealth();
    res.status(200).json(health);
});
router.get("/sessions", async (req, res) => {
    const sessions = await whatsappManager.getAllSessions();
    res.status(200).json(sessions);
});
router.post("/sessions", async (req, res) => {
    const { sessionId } = req.body;
    await db.addDevice(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: `Sessão "${sessionId}" iniciada.` });
});
router.delete("/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    await db.removeDevice(sessionId);
    const result = await whatsappManager.destroySession(sessionId);
    res.status(result ? 200 : 404).json({ message: result ? "Sessão removida." : "Sessão não encontrada." });
});
router.post("/sessions/:sessionId/restart", async (req, res) => {
    const { sessionId } = req.params;
    await whatsappManager.destroySession(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: `Sessão "${sessionId}" reiniciada.` });
});
router.get("/sessions/:sessionId/status", (req, res) => res.status(200).json({ status: whatsappManager.getSessionStatus(req.params.sessionId) }));
router.get("/sessions/:sessionId/qr", (req, res) => {
    const qrCodeUrl = whatsappManager.getQRCode(req.params.sessionId);
    res.status(qrCodeUrl ? 200 : 404).json({ qrCodeUrl });
});
router.post("/sessions/:sessionId/send", async (req, res) => {
    const { number, text } = req.body;
    const result = await whatsappManager.sendMessage(req.params.sessionId, number, text);
    res.status(result ? 200 : 404).json({ message: result ? "Mensagem enviada." : "Falha ao enviar." });
});

// --- Logic Files ---
router.get("/sessions/:sessionId/logics", (req, res) => {
    const dir = path.join("uploads", req.params.sessionId);
    if (!fs.existsSync(dir)) return res.json([]);
    res.json(fs.readdirSync(dir));
});
router.post("/sessions/:sessionId/logics/text", (req, res) => {
    const { fileName, content } = req.body;
    const dir = path.join("uploads", req.params.sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), content, "utf8");
    logger.log(`Lógica "${fileName}" salva na sessão "${req.params.sessionId}"`);
    res.status(201).send("Lógica salva.");
});
router.delete("/sessions/:sessionId/logics/:fileName", (req, res) => {
    const filePath = path.join("uploads", req.params.sessionId, req.params.fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.status(200).json({ message: "Arquivo deletado." });
    }
});

// --- AI Generation ---
router.post("/generate-rules", async (req, res) => {
    const { prompt } = req.body;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Chave Gemini não configurada." });

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const systemPrompt = `Você é um gerador de regras JSON para um Chatbot WhatsApp.
            Converta a descrição em JSON estrito:
            { "default_reply": "msg padrao", "rules": [{ "keywords": ["a"], "reply": "b", "pause_bot_after_reply": false, "image_url": "url" }] }`;
        
        const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (error) {
        logger.error("Erro Gemini Gen:", error);
        res.status(500).json({ error: "Falha na IA." });
    }
});

module.exports = router;
