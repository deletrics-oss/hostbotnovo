
// services/db.js
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

// Configuração do caminho local
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

// --- FUNÇÕES LOCAIS (JSON) ---
const localDB = {
    read: () => {
        try {
            if (!fs.existsSync(DB_PATH)) {
                localDB.write(INITIAL_DATA);
                return INITIAL_DATA;
            }
            const content = fs.readFileSync(DB_PATH, "utf8");
            if (!content || content.trim() === "") {
                localDB.write(INITIAL_DATA);
                return INITIAL_DATA;
            }
            const parsed = JSON.parse(content);
            
            // Self-healing
            if (!Array.isArray(parsed.users)) parsed.users = [DEFAULT_ADMIN];
            if (!parsed.devices) parsed.devices = [];
            
            const adminExists = parsed.users.some(u => u.name === 'admin' || u.email === 'admin@chatbot.com');
            if (!adminExists) {
                parsed.users.unshift(DEFAULT_ADMIN);
                localDB.write(parsed);
            }
            return parsed;
        } catch (error) {
            console.error("[DB] Local DB corrupto. Resetando.");
            localDB.write(INITIAL_DATA);
            return INITIAL_DATA;
        }
    },
    write: (data) => {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
        } catch (error) {
            console.error("Erro escrita DB local:", error);
        }
    }
};

// --- INTERFACE UNIFICADA ---
const db = {
    getDevices: () => {
        return localDB.read().devices;
    },
    addDevice: (sessionId) => {
        const data = localDB.read();
        if (!data.devices.includes(sessionId)) {
            data.devices.push(sessionId);
            localDB.write(data);
        }
    },
    removeDevice: (sessionId) => {
        const data = localDB.read();
        data.devices = data.devices.filter(d => d !== sessionId);
        localDB.write(data);
    },
    getUsers: () => {
        return localDB.read().users;
    },
    addUser: (user) => {
        const data = localDB.read();
        const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
        const newUser = { ...user, id: newId };
        data.users.push(newUser);
        localDB.write(data);
        return newUser;
    },
    removeUser: (userId) => {
        const data = localDB.read();
        const idx = data.users.findIndex(u => u.id == userId);
        if (idx > -1) {
            if (data.users[idx].name === 'admin') return false; // Proteção admin
            data.users.splice(idx, 1);
            localDB.write(data);
            return true;
        }
        return false;
    },
    findUser: (usernameOrEmail, password) => {
        const users = localDB.read().users;
        return users.find(u => {
            const isMatch = (u.name.toLowerCase() === usernameOrEmail.toLowerCase() || u.email.toLowerCase() === usernameOrEmail.toLowerCase());
            return isMatch && u.password === password;
        });
    }
};

module.exports = {
    ...db,
    readSync: localDB.read,
    writeSync: localDB.write
};
