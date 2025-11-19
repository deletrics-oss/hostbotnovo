
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
// Use PORT 3034 explicitly as requested
const PORT = process.env.PORT || 3034;

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api", require("./routes/api"));

// Serve Static Frontend (React Build)
// Ensure you run 'npm run build' in React and copy 'dist' or 'build' content to 'public' folder on server
app.use(express.static(path.join(__dirname, "public")));

// Catch-all for React Router
app.get("*", (req, res) => {
  if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API Endpoint Not Found' });
  }
  // If public/index.html exists, serve it. Otherwise send a basic status.
  const indexPath = path.join(__dirname, "public", "index.html");
  if (require("fs").existsSync(indexPath)) {
      res.sendFile(indexPath);
  } else {
      res.send(`
        <h1>ChatBot Host v2.5 Online</h1>
        <p>Backend running on port ${PORT}.</p>
        <p>Para ver o painel, faça o build do React e coloque na pasta 'public'.</p>
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
