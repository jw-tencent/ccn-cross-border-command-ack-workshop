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
  assert.equal(isOriginAllowed('http://localhost:8080', ['http://localhost:*']), true);
  assert.equal(isOriginAllowed('https://example.com', ['http://localhost:*']), false);
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

test('the included acknowledgement service defaults to a loopback listener', () => {
  assert.equal(loadConfig({}).host, '127.0.0.1');
  assert.equal(loadConfig({ HOST: '127.0.0.1' }).host, '127.0.0.1');
});
