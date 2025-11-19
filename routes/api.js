
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

// Middleware de Autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    req.user = user;
    next();
  });
}

// --- Auth ---

router.get("/auth/me", authenticateToken, (req, res) => {
    try {
        const users = db.getUsers();
        const found = users.find(u => u.name === req.user.user || u.email === req.user.user);
        
        if (found) {
            const { password, ...safeUser } = found;
            res.json(safeUser);
        } else {
            // Legacy fallback for old tokens
            res.json({ name: req.user.user, role: req.user.role || 'client', plan: 'plan_free' });
        }
    } catch(e) {
        logger.error("Erro /auth/me", e);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    try {
        const user = db.findUser(username, password);
        if (user) {
            const token = jwt.sign({ user: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            logger.log(`Login realizado: ${user.name}`);
            return res.status(200).json({ 
                success: true, 
                token, 
                user: { name: user.name, email: user.email, role: user.role, plan: user.plan } 
            });
        }
        logger.warn(`Login falhou para: ${username}`);
        res.status(401).json({ success: false, message: "Credenciais inválidas" });
    } catch (e) {
        logger.error("Erro no login:", e);
        res.status(500).json({ success: false, message: "Erro no servidor" });
    }
});

router.post("/auth/register", (req, res) => {
    const { name, email, password, plan } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Preencha todos os campos" });
    }
    try {
        const users = db.getUsers();
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: "Email já existe" });
        }
        const newUser = db.addUser({
            name, 
            email, 
            password, 
            role: 'client', 
            plan: plan ? plan.id : 'plan_free'
        });
        const token = jwt.sign({ user: newUser.name, role: 'client' }, JWT_SECRET, { expiresIn: '24h' });
        logger.log(`Novo usuário registrado: ${name}`);
        res.status(201).json({ success: true, token, user: newUser });
    } catch(e) {
        logger.error("Erro registro", e);
        res.status(500).json({ error: "Erro ao criar usuário" });
    }
});

// --- Clients ---
router.get("/users", authenticateToken, (req, res) => {
    try {
        const users = db.getUsers();
        // Remove passwords
        const safeUsers = users.map(u => { const {password, ...r} = u; return r; });
        res.json(safeUsers);
    } catch(e) { res.status(500).json({ error: "Erro ao listar usuários" }); }
});

router.post("/users", authenticateToken, (req, res) => {
    const { name, email, role } = req.body;
    try {
        const newUser = db.addUser({ name, email, password: '123', role: role || 'client' });
        res.status(201).json(newUser);
    } catch(e) { res.status(500).json({ error: "Erro ao criar usuário" }); }
});

router.delete("/users/:id", authenticateToken, (req, res) => {
    if (db.removeUser(req.params.id)) res.json({ success: true });
    else res.status(404).json({ error: "Não encontrado ou não pode deletar" });
});

// --- Sessions ---

router.get("/sessions", (req, res) => res.json(whatsappManager.getAllSessions()));

router.post("/sessions", (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "ID obrigatório" });
    db.addDevice(sessionId);
    whatsappManager.createSession(sessionId);
    res.status(201).json({ message: "Criado" });
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
    res.json({ message: "Reiniciando" });
});

router.get("/sessions/:sessionId/qr", (req, res) => {
    const url = whatsappManager.getQRCode(req.params.sessionId);
    res.json({ qrCodeUrl: url });
});

router.post("/sessions/:sessionId/send", async (req, res) => {
    const { number, text } = req.body;
    const success = await whatsappManager.sendMessage(req.params.sessionId, number, text);
    if (success) res.json({ message: "Enviado" });
    else res.status(500).json({ error: "Falha ao enviar" });
});

// --- Logic ---
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
    const file = path.join("uploads", req.params.sessionId, req.params.fileName);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ message: "Deletado" });
});

// --- AI ---
router.post("/generate-rules", async (req, res) => {
    const { prompt } = req.body;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Sem API Key" });
    
    try {
        const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(`Crie um JSON de regras para chatbot com base nisto: ${prompt}. Formato estrito JSON: { "rules": [{"keywords":[], "reply":""}] }`);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        res.json(JSON.parse(text));
    } catch(e) {
        res.status(500).json({ error: "Erro IA" });
    }
});

// --- Health ---
router.get("/health/gemini", async (req, res) => res.json(await whatsappManager.checkGeminiHealth()));

module.exports = router;
