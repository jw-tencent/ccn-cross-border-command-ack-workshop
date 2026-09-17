'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DIRECT_ROUTE_ID,
  DIRECT_ROUTE_STATUS,
  isOriginAllowed,
  loadConfig,
  validateCommand,
} = require('./server');

test('protocol validation accepts only a bounded v1 game command', () => {
  assert.deepEqual(validateCommand({
    type: 'game_command', eventId: 'event-1', command: 'fire', clientSentMonoMs: 1.25, schemaVersion: 1,
  }), { valid: true, eventId: 'event-1' });
  assert.equal(validateCommand({ type: 'game_command', eventId: 'bad value', command: 'fire', clientSentMonoMs: 1, schemaVersion: 1 }).valid, false);
  assert.equal(isOriginAllowed('http://localhost:8080', ['http://localhost:8080']), true);
  assert.equal(isOriginAllowed('http://localhost:49152', ['http://localhost:8080']), false);
  assert.equal(isOriginAllowed('https://example.com', ['http://localhost:8080']), false);
});

test('route environment overrides cannot turn the included server into a routed CCN path', () => {
  const config = loadConfig({
    ROUTE_ID: 'ccn-routed-spoof',
    ROUTE_STATUS: 'ccn-route-validated',
  });
  assert.equal(config.routeId, DIRECT_ROUTE_ID);
  assert.equal(config.routeStatus, DIRECT_ROUTE_STATUS);
  assert.deepEqual(config.warnings, ['Ignored route metadata override: this included service is Direct-only.']);
});

test('the included acknowledgement service enforces loopback and exact origins', () => {
  assert.equal(loadConfig({}).host, '127.0.0.1');
  assert.equal(loadConfig({ HOST: '127.0.0.1' }).host, '127.0.0.1');
  assert.equal(loadConfig({ HOST: '::1' }).host, '::1');
  assert.throws(() => loadConfig({ HOST: '0.0.0.0' }), /HOST must be 127\.0\.0\.1 or ::1/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: 'http://localhost:*' }), /ALLOWED_ORIGINS must contain exact HTTP\(S\) origins/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: 'https://*.example.com' }), /ALLOWED_ORIGINS must contain exact HTTP\(S\) origins/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: '*' }), /ALLOWED_ORIGINS must contain exact HTTP\(S\) origins/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: 'https://example.com/path' }), /ALLOWED_ORIGINS must contain exact HTTP\(S\) origins/);
});
