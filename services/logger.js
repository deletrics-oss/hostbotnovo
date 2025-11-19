let wss;
function setWss(s) { wss = s; }
function broadcast(l, m) {
    if (wss) wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: "log", level: l, message: `[${new Date().toLocaleTimeString()}] ${m}` })));
}
const logger = {
    log: (m) => { console.log(m); broadcast("INFO", m); },
    error: (m, e) => { console.error(m, e); broadcast("ERROR", `${m} ${e?.message || ''}`); },
    warn: (m) => { console.warn(m); broadcast("WARN", m); }
};
module.exports = { setWss, logger };