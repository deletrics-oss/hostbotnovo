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

const JWT_SECRET = process.env.JWT_SECRET || "secret_key_change_me";
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
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// AUTH
router.get("/auth/me", authenticateToken, (req, res) => {
    try {
        const users = db.getUsers();
        const found = users.find(u => u.name === req.user.user || u.email === req.user.user);
        if (found) {
            const { password, ...safeUser } = found;
            res.json(safeUser);
        } else {
            res.json({ name: req.user.user, role: 'client', plan: 'plan_free' });
        }
    } catch(e) {
        res.status(500).json({ error: "Erro servidor" });
    }
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.findUser(username, password);
    if (user) {
        const token = jwt.sign({ user: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, user: { name: user.name, role: user.role, plan: user.plan } });
    }
    res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
});

router.post("/auth/register", (req, res) => {
    const { name, email, password, plan } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Dados incompletos" });
    
    const users = db.getUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "Email já cadastrado" });
    
    const newUser = db.addUser({ name, email, password, role: 'client', plan: plan ? plan.id : 'plan_free' });
    const token = jwt.sign({ user: newUser.name, role: 'client' }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user: newUser });
});

// USERS
router.get("/users", authenticateToken, (req, res) => {
    const users = db.getUsers().map(u => { const {password, ...r} = u; return r; });
    res.json(users);
});

router.post("/users", authenticateToken, (req, res) => {
    const { name, email, role } = req.body;
    db.addUser({ name, email, password: '123', role: role || 'client' });
    res.status(201).json({ success: true });
});

router.delete("/users/:id", authenticateToken, (req, res) => {
    if (db.removeUser(req.params.id)) res.json({ success: true });
    else res.status(400).json({ error: "Erro ao remover" });
});

// SESSIONS
router.get("/sessions", (req, res) => res.json(whatsappManager.getAllSessions()));
router.post("/sessions", (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "ID necessário" });
    db.addDevice(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: "Iniciado" });
});
router.delete("/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    db.removeDevice(sessionId);
    await whatsappManager.destroySession(sessionId);
    res.json({ message: "Removido" });
});
router.post("/sessions/:sessionId/restart", async (req, res) => {
    const { sessionId } = req.params;
    await whatsappManager.destroySession(sessionId);
    whatsappManager.createSession(sessionId);
    res.json({ message: "Reiniciado" });
});
router.get("/sessions/:sessionId/qr", (req, res) => {
    const url = whatsappManager.getQRCode(req.params.sessionId);
    res.json({ qrCodeUrl: url });
});
router.post("/sessions/:sessionId/send", async (req, res) => {
    const { number, text } = req.body;
    const s = await whatsappManager.sendMessage(req.params.sessionId, number, text);
    res.json({ success: s });
});

// LOGIC
router.get("/sessions/:sessionId/logics", (req, res) => {
    const dir = path.join("uploads", req.params.sessionId);
    if (!fs.existsSync(dir)) return res.json([]);
    res.json(fs.readdirSync(dir));
});
router.post("/sessions/:sessionId/logics/text", (req, res) => {
    const { fileName, content } = req.body;
    const dir = path.join("uploads", req.params.sessionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), content, "utf8");
    res.status(201).json({ message: "Salvo" });
});
router.delete("/sessions/:sessionId/logics/:fileName", (req, res) => {
    const f = path.join("uploads", req.params.sessionId, req.params.fileName);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    res.json({ message: "Deletado" });
});

// AI
router.post("/generate-rules", async (req, res) => {
    const { prompt } = req.body;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Sem API Key" });
    try {
        const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const r = await model.generateContent(`Crie JSON de regras chatbot: ${prompt}. Formato: { "rules": [{"keywords":[], "reply":""}] }`);
        const txt = r.response.text().replace(/```json|```/g, '').trim();
        res.json(JSON.parse(txt));
    } catch(e) { res.status(500).json({ error: "Erro IA" }); }
});

router.get("/health/gemini", async (req, res) => res.json(await whatsappManager.checkGeminiHealth()));

module.exports = router;