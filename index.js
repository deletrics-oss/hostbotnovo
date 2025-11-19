const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { WebSocketServer } = require("ws");
const db = require("./services/db");
const { createSession } = require("./services/whatsappManager");
const { setWss: setWhatsappWss } = require("./services/whatsappManager");
const { setWss: setLoggerWss, logger } = require("./services/logger");

const app = express();
// Force Port 3034
const PORT = process.env.PORT || 3034;

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api", require("./routes/api"));

// Serve Static Frontend (The 'public' folder is created by 'npm run build')
const publicPath = path.join(__dirname, "public");
if (require("fs").existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Handle React Routing (Any request not starting with /api goes to index.html)
app.get("*", (req, res) => {
  if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API Endpoint Not Found' });
  }
  
  const indexPath = path.join(__dirname, "public", "index.html");
  if (require("fs").existsSync(indexPath)) {
      res.sendFile(indexPath);
  } else {
      res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>ChatBot Host v2.5 - Backend Online</h1>
            <p>O servidor está rodando na porta <strong>${PORT}</strong>.</p>
            <hr/>
            <h3>⚠️ O Painel não foi encontrado.</h3>
            <p>Para corrigir, execute este comando no terminal do servidor:</p>
            <code style="background: #eee; padding: 10px; display: block; margin: 20px auto; max-width: 200px;">npm run build</code>
        </div>
      `);
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setWhatsappWss(wss);
setLoggerWss(wss);

wss.on("connection", ws => {
    logger.log("🔌 Novo cliente conectado ao WebSocket.");
    ws.on("error", err => logger.error("WebSocket Error", err));
});

function initializeBots() {
    logger.log("--- Iniciando Sincronização de Bots ---");
    try {
        const devices = db.getDevices();
        if (devices.length > 0) {
            logger.log(`Encontrados ${devices.length} dispositivos para iniciar: ${devices.join(", ")}`);
            devices.forEach(id => createSession(id));
        } else {
            logger.log("Nenhum dispositivo salvo para iniciar.");
        }
    } catch (e) {
        logger.error("Erro ao inicializar bots:", e);
    }
    logger.log("--- Sincronização Concluída ---");
}

server.listen(PORT, () => {
    logger.log(`🚀 Servidor HTTP e WebSocket v2.5 rodando na porta ${PORT}`);
    initializeBots();
});