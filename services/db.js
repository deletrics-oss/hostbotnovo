const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

// Ensure we use the root directory for persistence
const DB_PATH = path.join(process.cwd(), "database.json");

const DEFAULT_ADMIN = {
    id: 1,
    name: 'admin',
    email: 'admin@chatbot.com',
    password: 'suporte@1',
    role: 'admin',
    plan: 'prod_TSBFAZOMsCNIAT'
};

const INITIAL_DATA = {
    devices: [],
    users: [DEFAULT_ADMIN]
};

const db = {
    read: () => {
        try {
            if (!fs.existsSync(DB_PATH)) {
                logger.warn("[DB] Criando novo database.json...");
                db.write(INITIAL_DATA);
                return INITIAL_DATA;
            }
            const content = fs.readFileSync(DB_PATH, "utf8");
            if (!content || content.trim() === "") {
                logger.warn("[DB] Arquivo vazio. Resetando...");
                db.write(INITIAL_DATA);
                return INITIAL_DATA;
            }
            
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                logger.error("[DB] JSON Corrompido. Resetando.", e);
                db.write(INITIAL_DATA);
                return INITIAL_DATA;
            }
            
            let dirty = false;
            if (!Array.isArray(parsed.users)) { parsed.users = [DEFAULT_ADMIN]; dirty = true; }
            if (!Array.isArray(parsed.devices)) { parsed.devices = []; dirty = true; }
            
            // Self-Healing: Ensure Admin Exists
            const adminExists = parsed.users.some(u => u.name.toLowerCase() === 'admin');
            if (!adminExists) {
                logger.warn("[DB] Restaurando usuário Admin...");
                parsed.users.unshift(DEFAULT_ADMIN);
                dirty = true;
            }

            if (dirty) db.write(parsed);
            return parsed;
        } catch (error) {
            logger.error("[DB] Erro crítico.", error);
            return INITIAL_DATA;
        }
    },
    write: (data) => {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
        } catch (error) {
            logger.error("[DB] Erro de escrita.", error);
        }
    },
    addDevice: (sessionId) => {
        const data = db.read();
        if (!data.devices.includes(sessionId)) {
            data.devices.push(sessionId);
            db.write(data);
            logger.log(`[DB] Dispositivo salvo: ${sessionId}`);
        }
    },
    removeDevice: (sessionId) => {
        const data = db.read();
        data.devices = data.devices.filter(d => d !== sessionId);
        db.write(data);
        logger.log(`[DB] Dispositivo removido: ${sessionId}`);
    },
    getDevices: () => db.read().devices,
    getUsers: () => db.read().users,
    addUser: (user) => {
        const data = db.read();
        const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
        const newUser = { ...user, id: newId };
        data.users.push(newUser);
        db.write(data);
        return newUser;
    },
    removeUser: (userId) => {
        const data = db.read();
        const idx = data.users.findIndex(u => u.id == userId);
        if (idx > -1) {
            if (data.users[idx].name === 'admin') return false;
            data.users.splice(idx, 1);
            db.write(data);
            return true;
        }
        return false;
    },
    findUser: (usernameOrEmail, password) => {
        const users = db.read().users;
        return users.find(u => {
            const isName = u.name && u.name.toLowerCase() === usernameOrEmail.toLowerCase();
            const isEmail = u.email && u.email.toLowerCase() === usernameOrEmail.toLowerCase();
            return (isName || isEmail) && u.password === password;
        });
    }
};

module.exports = db;