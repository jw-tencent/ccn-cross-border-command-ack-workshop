'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

/** @param {Buffer} payload @returns {Buffer} */
function makeMaskedTextFrame(payload) {
  const mask = crypto.randomBytes(4);
  const header = payload.length <= 125
    ? Buffer.from([0x81, 0x80 | payload.length])
    : Buffer.from([0x81, 0xFE, payload.length >> 8, payload.length & 0xff]);
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

/** @param {Buffer} buffer @returns {{payload: Buffer, remaining: Buffer} | null} */
function readTextFrame(buffer) {
  if (buffer.length < 2 || (buffer[0] & 0x0f) !== 0x1) return null;
  let payloadLength = buffer[1] & 0x7f;
  let headerLength = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    headerLength = 4;
  }
  if (buffer.length < headerLength + payloadLength) return null;
  return { payload: buffer.subarray(headerLength, headerLength + payloadLength), remaining: buffer.subarray(headerLength + payloadLength) };
}

/** @param {number} port @returns {Promise<object>} */
function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/healthz' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body: JSON.parse(body) }));
    });
    request.on('error', reject);
  });
}

/** @param {number} port @returns {Promise<{socket: net.Socket, nextJson: () => Promise<object>}>} */
function connectWebSocket(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for WebSocket handshake.')), 3000);
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    /** @type {Array<{resolve: (message: object) => void, reject: (error: Error) => void}>} */
    const readers = [];
    const nextJson = () => new Promise((resolveMessage, rejectMessage) => {
      const readerTimeout = setTimeout(() => rejectMessage(new Error('Timed out waiting for ACK.')), 3000);
      readers.push({ resolve: (message) => { clearTimeout(readerTimeout); resolveMessage(message); }, reject: rejectMessage });
    });
    socket.on('connect', () => {
      const key = crypto.randomBytes(16).toString('base64');
      socket.write([
        'GET /ws HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', 'Origin: http://localhost:8080', '\r\n',
      ].join('\r\n'));
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const boundary = buffer.indexOf('\r\n\r\n');
        if (boundary === -1) return;
        assert.match(buffer.subarray(0, boundary).toString('ascii'), /^HTTP\/1\.1 101 Switching Protocols/m);
        upgraded = true;
        buffer = buffer.subarray(boundary + 4);
        clearTimeout(timeout);
        resolve({ socket, nextJson });
      }
      while (readers.length > 0) {
        const frame = readTextFrame(buffer);
        if (!frame) return;
        buffer = frame.remaining;
        readers.shift().resolve(JSON.parse(frame.payload.toString('utf8')));
      }
    });
    socket.on('error', reject);
    socket.on('close', () => {
      if (!upgraded) reject(new Error('WebSocket closed before Upgrade.'));
      readers.splice(0).forEach((reader) => reader.reject(new Error('WebSocket closed before ACK.')));
    });
  });
}

/** @param {number} port @param {string | undefined} origin @returns {Promise<number>} */
function requestUpgradeStatus(port, origin) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback(value);
    };
    const timeout = setTimeout(() => finish(reject, new Error('Timed out waiting for rejected WebSocket handshake.')), 3000);
    socket.on('connect', () => {
      const key = crypto.randomBytes(16).toString('base64');
      const headers = [
        'GET /ws HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13',
      ];
      if (origin) headers.push(`Origin: ${origin}`);
      headers.push('\r\n');
      socket.write(headers.join('\r\n'));
    });
    socket.on('data', (chunk) => {
      const match = /^HTTP\/1\.1 (\d{3})/.exec(chunk.toString('ascii'));
      if (!match) return finish(reject, new Error('Invalid WebSocket handshake response.'));
      clearTimeout(timeout);
      finish(resolve, Number(match[1]));
    });
    socket.on('error', (error) => { clearTimeout(timeout); finish(reject, error); });
    socket.on('close', () => {
      if (!settled) {
        clearTimeout(timeout);
        finish(reject, new Error('WebSocket closed before a handshake response.'));
      }
    });
  });
}

/** @returns {Promise<number>} */
function reserveLocalPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = probe.address();
      if (!address || typeof address !== 'object') {
        probe.close(() => reject(new Error('Could not reserve a local TCP port.')));
        return;
      }
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

/** @param {number} port @returns {Promise<{process: import('node:child_process').ChildProcess, stderr: () => string}>} */
function startIncludedServer(port) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: {
        ...process.env,
        PORT: String(port),
        ALLOWED_ORIGINS: 'http://localhost:8080',
        ROUTE_ID: 'ccn-routed-spoof',
        ROUTE_STATUS: 'ccn-route-validated',
        VERSION: 'smoke',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => reject(new Error('Timed out starting the included server.')), 3000);
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.stdout.on('data', (chunk) => {
      if (chunk.toString('utf8').includes(`Command ACK service listening on 127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolve({ process: child, stderr: () => stderr });
      }
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Included server exited before smoke check with code ${code}.`)); });
  });
}

/** @param {import('node:child_process').ChildProcess} child @returns {Promise<void>} */
function stopIncludedServer(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill();
  });
}

async function main() {
  const port = await reserveLocalPort();
  const includedServer = await startIncludedServer(port);
  let client;
  try {
    const health = await requestHealth(port);
    assert.deepEqual(health, {
      statusCode: 200,
      body: { status: 'ok', version: 'smoke', routeId: 'same-us-origin-direct', routeStatus: 'direct_ack_only' },
    });
    assert.equal(await requestUpgradeStatus(port, 'http://localhost:49152'), 403);
    assert.equal(await requestUpgradeStatus(port, undefined), 403);
    client = await connectWebSocket(port);
    const command = Buffer.from(JSON.stringify({ type: 'game_command', eventId: 'smoke-event-1', command: 'fire', clientSentMonoMs: 12.5, schemaVersion: 1 }), 'utf8');
    const accepted = client.nextJson(); client.socket.write(makeMaskedTextFrame(command));
    const acceptedAck = await accepted;
    assert.equal(acceptedAck.type, 'ack');
    assert.equal(acceptedAck.eventId, 'smoke-event-1');
    assert.equal(acceptedAck.outcome, 'accepted');
    assert.equal(acceptedAck.routeId, 'same-us-origin-direct');
    assert.equal(acceptedAck.routeStatus, 'direct_ack_only');
    assert.equal(acceptedAck.schemaVersion, 1);
    const duplicate = client.nextJson(); client.socket.write(makeMaskedTextFrame(command));
    const duplicateAck = await duplicate;
    assert.equal(duplicateAck.outcome, 'duplicate');
    assert.equal(duplicateAck.routeId, 'same-us-origin-direct');
    assert.equal(duplicateAck.routeStatus, 'direct_ack_only');
    assert.match(includedServer.stderr(), /Ignored route metadata override: this included service is Direct-only\./);
    console.log('Smoke passed: a booted backend with spoofed route environment stayed Direct-only; health, RFC6455 Upgrade, masked command, ACK, and duplicate ACK validated.');
  } finally {
    if (client) client.socket.destroy();
    await stopIncludedServer(includedServer.process);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
