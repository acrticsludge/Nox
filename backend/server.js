// Nox game server — /health + WebSocket protocol ONLY (O6).
// The website is the Astro app in ../frontend (Vercel); this process is the
// authoritative multiplayer server (Render). Static serving was removed.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { attachNet } from './net.js';
import { attachRooms } from './rooms.js';
import { startMatch, attachMatchRouting } from './match.js';

const PORT = Number(process.env.PORT) || 3000;

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && urlPath === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ ok: true, service: 'nox' }));
      return;
    }
    res.writeHead(req.method === 'GET' || req.method === 'HEAD' ? 404 : 405, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'GET' || req.method === 'HEAD' ? 'Not Found' : 'Method Not Allowed');
  });

  // TCP optimizations at HTTP level (covers upgrade path)
  server.on('connection', socket => socket.setNoDelay(true));

  const net = attachNet(server);
  server.noxNet = net;
  const roomsApi = attachRooms(server, net, {
    onRoomFull: room => startMatch(room, net, {
      // Task 12: terminal room behavior — a naturally finished match keeps the
      // room in rematchWait (mutual rematch re-fires onRoomFull); anything
      // else tears the room down silently (no peerLeft after matchEnd)
      onEnd: (room, keep) => {
        if (keep) {
          room.state = 'rematchWait';
          room.rematch = new Set();
          for (const s of room.seats) if (s) roomsApi.sendRoomTo(s, room);
          return;
        }
        for (const s of room.seats) {
          if (s) {
            try { s.send(JSON.stringify({ type: 'roomClosed' })); } catch {}
            roomsApi.leave(s, false, false);
          }
        }
        roomsApi.rooms.delete(room.code);
      },
    }),
  });
  net.noxRooms = roomsApi.rooms;
  attachMatchRouting(net);
  return server;
}

// Auto-start only when run directly (`npm start`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(PORT, () => console.log(`[nox] game server on :${PORT}`));
}
