// Binary codec for WebSocket frames — reduces size and parse latency
// Input frame: 2 bytes (seq: 1 byte, mask: 1 byte) — but seq needs more range
// Actually: seq can wrap at 255, so 1 byte is fine for 60Hz (4.2 min wrap)

export const MSG_TYPE = {
  INPUT: 0x01,
  SNAPSHOT: 0x02,
  PING: 0x03,
  PONG: 0x04,
  HELLO: 0x05,
  SESSION: 0x06,
  ROOM: 0x07,
  COUNTDOWN: 0x08,
  ROUND_END: 0x09,
  MATCH_END: 0x0A,
  PEER_LEFT: 0x0B,
  PEER_BACK: 0x0C,
  RECONNECT_CRED: 0x0D,
  REJOINED: 0x0E,
  QUEUED: 0x0F,
  ROOM_ERROR: 0x10,
  SERVER_OUTDATED: 0x11,
};

// Input frame: [type:1][seq:1][mask:1] = 3 bytes
export function encodeInput(seq, mask) {
  const buf = new Uint8Array(3);
  buf[0] = MSG_TYPE.INPUT;
  buf[1] = seq & 0xFF;
  buf[2] = mask & 0xFF;
  return buf;
}

export function decodeInput(buf) {
  if (buf.length < 3) return null;
  return {
    type: 'input',
    seq: buf[1],
    mask: buf[2],
  };
}

// Ping/Pong: [type:1][timestamp:8] = 9 bytes (or just type for pong)
export function encodePing() {
  const buf = new Uint8Array(9);
  buf[0] = MSG_TYPE.PING;
  const now = Date.now();
  const view = new DataView(buf.buffer, 1);
  view.setBigUint64(0, BigInt(now), false);
  return buf;
}

export function decodePing(buf) {
  if (buf.length < 9) return null;
  const view = new DataView(buf.buffer, buf.byteOffset + 1);
  return { type: 'ping', t: Number(view.getBigUint64(0, false)) };
}

export function encodePong(clientTimestamp) {
  const buf = new Uint8Array(9);
  buf[0] = MSG_TYPE.PONG;
  const view = new DataView(buf.buffer, 1);
  view.setBigUint64(0, BigInt(clientTimestamp), false);
  return buf;
}

export function decodePong(buf) {
  if (buf.length < 9) return null;
  const view = new DataView(buf.buffer, buf.byteOffset + 1);
  return { type: 'pong', t: Number(view.getBigUint64(0, false)) };
}

// Snapshot encoding - compact binary format
// This is more complex, so we'll start with a simplified version
// Full snapshot: variable size, but we encode efficiently

export function encodeSnapshot(snapshot) {
  // For now, fall back to JSON for snapshots (they're larger but less frequent)
  // We'll optimize this in delta compression task
  const json = JSON.stringify(snapshot);
  const buf = new Uint8Array(json.length + 1);
  buf[0] = MSG_TYPE.SNAPSHOT;
  for (let i = 0; i < json.length; i++) {
    buf[i + 1] = json.charCodeAt(i);
  }
  return buf;
}

export function decodeSnapshot(buf) {
  if (buf.length < 2) return null;
  try {
    const json = new TextDecoder().decode(buf.slice(1));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Generic message decoder
export function decodeMessage(buf) {
  if (!buf || buf.length === 0) return null;
  const type = buf[0];
  
  switch (type) {
    case MSG_TYPE.INPUT:
      return decodeInput(buf);
    case MSG_TYPE.PING:
      return decodePing(buf);
    case MSG_TYPE.PONG:
      return decodePong(buf);
    case MSG_TYPE.SNAPSHOT:
      return decodeSnapshot(buf);
    default:
      // Fallback to JSON for other message types
      try {
        const json = new TextDecoder().decode(buf);
        return JSON.parse(json);
      } catch {
        return null;
      }
  }
}

// Check if buffer is binary format
export function isBinaryMessage(buf) {
  return buf instanceof ArrayBuffer || buf instanceof Uint8Array;
}