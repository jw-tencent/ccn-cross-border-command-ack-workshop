'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { URL } = require('node:url');

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_DEDUPE_TTL_MS = 60 * 1000;
const DIRECT_ROUTE_ID = 'same-us-origin-direct';
const DIRECT_ROUTE_STATUS = 'direct_ack_only';
const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  'http://localhost:*',
  'http://127.0.0.1:*',
  'http://[::1]:*',
];

/** @typedef {{host: string, port: number, allowedOrigins: string[], routeId: string, routeStatus: string, version: string, maxPayloadBytes: number, dedupeTtlMs: number, warnings: string[]}} ServerConfig */

/** @param {string | undefined} value @param {number} fallback @param {number} min @param {number} max @returns {number} */
function parseBoundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** @param {string | undefined} rawValue @returns {string[]} */
function parseAllowedOrigins(rawValue) {
  const origins = (rawValue ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const resolved = origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGIN_PATTERNS;
  if (resolved.some((origin) => origin === '*' || origin.includes('://*.'))) {
    throw new Error('ALLOWED_ORIGINS does not permit broad wildcard origins.');
  }
  return resolved;
}

/**
 * Resolves immutable metadata for this Direct-only deliverable.
 *
 * Route environment variables are intentionally not configuration inputs. Exact
 * Direct-only values are tolerated for backwards-compatible deployment files;
 * every other value is ignored and reported without echoing user input.
 *
 * @param {NodeJS.ProcessEnv} environment
 * @returns {string[]}
 */
function collectRouteOverrideWarnings(environment) {
  const routeId = environment.ROUTE_ID?.trim();
  const routeStatus = environment.ROUTE_STATUS?.trim();
  if ((!routeId || routeId === DIRECT_ROUTE_ID) && (!routeStatus || routeStatus === DIRECT_ROUTE_STATUS)) return [];
  return ['Ignored route metadata override: this included service is Direct-only.'];
}

/** @param {NodeJS.ProcessEnv} environment @returns {ServerConfig} */
function loadConfig(environment = process.env) {
  const maxPayloadBytes = parseBoundedInteger(
    environment.MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
    256,
    DEFAULT_MAX_PAYLOAD_BYTES,
  );
  return {
    // The acknowledgement service must sit behind the TLS reverse proxy.
    // Bind loopback by default so a cloud security-group rule is never the
    // only control preventing plaintext WebSocket exposure.
    host: environment.HOST?.trim() || '127.0.0.1',
    port: parseBoundedInteger(environment.PORT, 8787, 1, 65535),
    allowedOrigins: parseAllowedOrigins(environment.ALLOWED_ORIGINS),
    routeId: DIRECT_ROUTE_ID,
    routeStatus: DIRECT_ROUTE_STATUS,
    version: environment.VERSION?.trim() || '1.0.0',
    maxPayloadBytes,
    dedupeTtlMs: parseBoundedInteger(
      environment.DEDUPE_TTL_MS,
      DEFAULT_DEDUPE_TTL_MS,
      1000,
      10 * 60 * 1000,
    ),
    warnings: collectRouteOverrideWarnings(environment),
  };
}

/** @param {string | undefined} origin @param {string[]} allowedOrigins @returns {boolean} */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.endsWith(':*')) {
      const prefix = allowedOrigin.slice(0, -1);
      return origin.startsWith(prefix) && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin);
    }
    return origin === allowedOrigin;
  });
}

/** @param {http.ServerResponse} response @param {number} statusCode @param {object} body */
function sendJson(response, statusCode, body) {
  const serializedBody = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(serializedBody),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(serializedBody);
}

/** @param {number} code @param {string} reason @returns {Buffer} */
function closePayload(code, reason) {
  const reasonBytes = Buffer.from(reason, 'utf8').subarray(0, 123);
  const payload = Buffer.alloc(2 + reasonBytes.length);
  payload.writeUInt16BE(code, 0);
  reasonBytes.copy(payload, 2);
  return payload;
}

/** @param {number} opcode @param {Buffer} payload @returns {Buffer} */
function makeFrame(opcode, payload) {
  if (payload.length > DEFAULT_MAX_PAYLOAD_BYTES) {
    throw new Error('Outbound WebSocket payload is too large.');
  }
  let header;
  if (payload.length <= 125) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  return Buffer.concat([header, payload]);
}

/** @param {import('node:net').Socket} socket @param {number} opcode @param {Buffer} payload */
function writeFrame(socket, opcode, payload) {
  if (!socket.destroyed) socket.write(makeFrame(opcode, payload));
}

/** @param {import('node:net').Socket} socket @param {number} code @param {string} reason */
function closeSocket(socket, code, reason) {
  if (!socket.destroyed) {
    writeFrame(socket, 0x8, closePayload(code, reason));
    socket.end();
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} message @returns {{valid: true, eventId: string} | {valid: false, code: string, message: string}} */
function validateCommand(message) {
  if (!isPlainObject(message)) {
    return { valid: false, code: 'invalid_payload', message: 'Payload must be a JSON object.' };
  }
  if (message.type !== 'game_command') {
    return { valid: false, code: 'unsupported_type', message: 'type must be game_command.' };
  }
  if (message.schemaVersion !== 1) {
    return { valid: false, code: 'unsupported_schema', message: 'schemaVersion must be 1.' };
  }
  if (typeof message.eventId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(message.eventId)) {
    return { valid: false, code: 'invalid_event_id', message: 'eventId must contain 1-128 safe identifier characters.' };
  }
  if (typeof message.command !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(message.command)) {
    return { valid: false, code: 'invalid_command', message: 'command must contain 1-64 safe identifier characters.' };
  }
  if (typeof message.clientSentMonoMs !== 'number' || !Number.isFinite(message.clientSentMonoMs)) {
    return { valid: false, code: 'invalid_client_timestamp', message: 'clientSentMonoMs must be a finite number.' };
  }
  return { valid: true, eventId: message.eventId };
}

/** @param {string | undefined} eventId @param {string} code @param {string} message @param {boolean} retryable @returns {object} */
function makeServerError(eventId, code, message, retryable) {
  const payload = { type: 'server_error', code, message, retryable, schemaVersion: 1 };
  if (eventId) payload.eventId = eventId;
  return payload;
}

/** @param {Buffer} buffer @param {number} maxPayloadBytes @returns {{frames: Array<{opcode: number, payload: Buffer}>, remaining: Buffer, error?: {code: number, reason: string}}} */
function parseFrames(buffer, maxPayloadBytes) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 2) break;
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const fin = (firstByte & 0x80) !== 0;
    const rsv = firstByte & 0x70;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (!fin || rsv !== 0 || !masked) {
      return { frames, remaining: Buffer.alloc(0), error: { code: 1002, reason: 'Unsupported WebSocket frame.' } };
    }
    if (payloadLength === 126) {
      if (buffer.length - offset < 4) break;
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (buffer.length - offset < 10) break;
      const highBits = buffer.readUInt32BE(offset + 2);
      const lowBits = buffer.readUInt32BE(offset + 6);
      if (highBits !== 0 || lowBits > maxPayloadBytes) {
        return { frames, remaining: Buffer.alloc(0), error: { code: 1009, reason: 'Payload too large.' } };
      }
      payloadLength = lowBits;
      headerLength = 10;
    }
    const isControlFrame = opcode >= 0x8;
    if (payloadLength > maxPayloadBytes || (isControlFrame && payloadLength > 125)) {
      return { frames, remaining: Buffer.alloc(0), error: { code: 1009, reason: 'Payload too large.' } };
    }
    const frameLength = headerLength + 4 + payloadLength;
    if (buffer.length - offset < frameLength) break;
    const maskOffset = offset + headerLength;
    const payloadOffset = maskOffset + 4;
    const mask = buffer.subarray(maskOffset, payloadOffset);
    const payload = Buffer.from(buffer.subarray(payloadOffset, payloadOffset + payloadLength));
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    frames.push({ opcode, payload });
    offset += frameLength;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

/** @param {ServerConfig} config @returns {http.Server} */
function createRelayServer(config) {
  const directOnlyConfig = {
    ...config,
    routeId: DIRECT_ROUTE_ID,
    routeStatus: DIRECT_ROUTE_STATUS,
  };
  /** @type {Map<string, number>} */
  const dedupeEntries = new Map();

  /** @returns {void} */
  function pruneDeduplication() {
    const now = Date.now();
    for (const [key, expiresAt] of dedupeEntries) {
      if (expiresAt <= now) dedupeEntries.delete(key);
    }
  }

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
      sendJson(response, 200, {
        status: 'ok',
        version: directOnlyConfig.version,
        routeId: directOnlyConfig.routeId,
        routeStatus: directOnlyConfig.routeStatus,
      });
      return;
    }
    sendJson(response, 404, { status: 'not_found' });
  });

  server.on('upgrade', (request, socket) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    const upgrade = String(request.headers.upgrade || '').toLowerCase();
    const connection = String(request.headers.connection || '').toLowerCase();
    const origin = request.headers.origin;
    const websocketKey = request.headers['sec-websocket-key'];
    const websocketVersion = request.headers['sec-websocket-version'];

    /** @param {number} statusCode @param {string} reason */
    function rejectUpgrade(statusCode, reason) {
      socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    }

    if (requestUrl.pathname !== '/ws') return rejectUpgrade(404, 'Not Found');
    if (upgrade !== 'websocket' || !connection.includes('upgrade') || websocketVersion !== '13') {
      return rejectUpgrade(400, 'Bad Request');
    }
    if (typeof websocketKey !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(websocketKey)) {
      return rejectUpgrade(400, 'Bad Request');
    }
    if (!isOriginAllowed(origin, directOnlyConfig.allowedOrigins)) return rejectUpgrade(403, 'Forbidden');

    const accept = crypto.createHash('sha1').update(`${websocketKey}${WEBSOCKET_GUID}`).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      'Cache-Control: no-store',
      '\r\n',
    ].join('\r\n'));
    socket.setTimeout(0);
    socket.setNoDelay(true);

    const sessionId = crypto.randomUUID();
    let pendingBuffer = Buffer.alloc(0);
    let closeReceived = false;

    /** @param {object} payload */
    function sendJsonFrame(payload) {
      writeFrame(socket, 0x1, Buffer.from(JSON.stringify(payload), 'utf8'));
    }

    /** @param {string | undefined} eventId @param {string} code @param {string} message @param {boolean} retryable */
    function sendError(eventId, code, message, retryable) {
      sendJsonFrame(makeServerError(eventId, code, message, retryable));
    }

    /** @param {Buffer} payload */
    function handleText(payload) {
      let decoded;
      let message;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(payload);
        message = JSON.parse(decoded);
      } catch {
        sendError(undefined, 'invalid_json', 'Payload must be valid UTF-8 JSON.', false);
        closeSocket(socket, 1007, 'Invalid JSON');
        return;
      }
      const validation = validateCommand(message);
      if (!validation.valid) {
        const eventId = isPlainObject(message) && typeof message.eventId === 'string' ? message.eventId : undefined;
        sendError(eventId, validation.code, validation.message, false);
        return;
      }
      pruneDeduplication();
      const dedupeKey = `${sessionId}\u0000${validation.eventId}`;
      const isDuplicate = dedupeEntries.has(dedupeKey);
      if (!isDuplicate) dedupeEntries.set(dedupeKey, Date.now() + directOnlyConfig.dedupeTtlMs);
      const receivedAt = performance.now();
      const ackSentAt = performance.now();
      sendJsonFrame({
        type: 'ack',
        eventId: validation.eventId,
        outcome: isDuplicate ? 'duplicate' : 'accepted',
        routeId: directOnlyConfig.routeId,
        routeStatus: directOnlyConfig.routeStatus,
        serverReceivedMonoMs: Number(receivedAt.toFixed(3)),
        serverAckSentMonoMs: Number(ackSentAt.toFixed(3)),
        schemaVersion: 1,
      });
    }

    socket.on('data', (chunk) => {
      if (closeReceived || socket.destroyed) return;
      pendingBuffer = Buffer.concat([pendingBuffer, chunk]);
      if (pendingBuffer.length > directOnlyConfig.maxPayloadBytes + 14) {
        closeSocket(socket, 1009, 'Payload too large');
        return;
      }
      const parsed = parseFrames(pendingBuffer, directOnlyConfig.maxPayloadBytes);
      pendingBuffer = parsed.remaining;
      if (parsed.error) {
        closeSocket(socket, parsed.error.code, parsed.error.reason);
        return;
      }
      for (const frame of parsed.frames) {
        if (frame.opcode === 0x1) {
          handleText(frame.payload);
        } else if (frame.opcode === 0x8) {
          closeReceived = true;
          writeFrame(socket, 0x8, frame.payload.length > 0 ? frame.payload : closePayload(1000, 'Normal closure'));
          socket.end();
          return;
        } else if (frame.opcode === 0x9) {
          writeFrame(socket, 0xA, frame.payload);
        } else if (frame.opcode === 0xA) {
          // A client pong is intentionally ignored.
        } else {
          closeSocket(socket, 1003, 'Unsupported data type');
          return;
        }
      }
    });
    socket.on('error', () => {
      // Transport errors are intentionally contained per connection.
    });
  });
  return server;
}

if (require.main === module) {
  const config = loadConfig();
  config.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  const server = createRelayServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`Command ACK service listening on ${config.host}:${config.port}; route=${config.routeId}; status=${config.routeStatus}`);
  });
}

module.exports = {
  DIRECT_ROUTE_ID,
  DIRECT_ROUTE_STATUS,
  createRelayServer,
  isOriginAllowed,
  loadConfig,
  parseFrames,
  validateCommand,
};
