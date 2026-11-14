// Relay: iPhone (PWA) <-> servidor <-> TV Samsung (app Tizen)
// A TV se registra e recebe um código de 4 dígitos; o celular entra com o código.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const PHONE_DIR = path.join(__dirname, '..', 'phone');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const VALID_KEYS = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT', 'OK', 'BACK', 'HOME',
  'VOL_UP', 'VOL_DOWN', 'MUTE', 'PLAY', 'PAUSE', 'FF', 'REW', 'MENU',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const rel = url === '/' ? 'index.html' : path.normalize(url).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PHONE_DIR, rel);
  if (!file.startsWith(PHONE_DIR)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { tv: ws, phones: Set<ws> }

function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(c));
  return c;
}
const send = (ws, obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let role = null, code = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'tv-register' && !role) {
      role = 'tv';
      // permite reconectar mantendo o mesmo código
      code = (msg.code && rooms.has(msg.code) && !rooms.get(msg.code).tv) ? msg.code
           : (msg.code && /^\d{4}$/.test(msg.code) && !rooms.has(msg.code)) ? msg.code : newCode();
      const room = rooms.get(code) || { tv: null, phones: new Set() };
      room.tv = ws; rooms.set(code, room);
      send(ws, { type: 'registered', code });
      room.phones.forEach((p) => send(p, { type: 'tv-online' }));
    } else if (msg.type === 'phone-join' && !role) {
      const room = rooms.get(String(msg.code));
      if (!room) return send(ws, { type: 'error', error: 'Código inválido' });
      role = 'phone'; code = String(msg.code);
      room.phones.add(ws);
      send(ws, { type: 'joined', tvOnline: !!room.tv });
      if (room.tv) send(room.tv, { type: 'phone-joined' });
    } else if (msg.type === 'key' && role === 'phone') {
      const room = rooms.get(code);
      if (!room || !room.tv) return send(ws, { type: 'error', error: 'TV offline' });
      if (!VALID_KEYS.has(msg.key)) return;
      send(room.tv, { type: 'key', key: msg.key, long: !!msg.long });
    } else if (msg.type === 'text' && role === 'phone') {
      const room = rooms.get(code);
      if (room && room.tv && typeof msg.text === 'string')
        send(room.tv, { type: 'text', text: msg.text.slice(0, 200) });
    }
  });

  ws.on('close', () => {
    const room = rooms.get(code);
    if (!room) return;
    if (role === 'tv') {
      room.tv = null;
      room.phones.forEach((p) => send(p, { type: 'tv-offline' }));
      // mantém a sala por 60s para a TV reconectar com o mesmo código
      setTimeout(() => { const r = rooms.get(code); if (r && !r.tv) rooms.delete(code); }, 60000);
    } else if (role === 'phone') room.phones.delete(ws);
  });
});

setInterval(() => wss.clients.forEach((ws) => {
  if (!ws.isAlive) return ws.terminate();
  ws.isAlive = false; ws.ping();
}), 15000);

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('Relay ativo. No iPhone abra:');
  ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  console.log('Na TV use (config.js): ' + ips.map((ip) => `ws://${ip}:${PORT}`).join(' ou '));
});
