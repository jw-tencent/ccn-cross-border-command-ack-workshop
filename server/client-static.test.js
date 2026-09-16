'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const APP_PATH = path.join(__dirname, '..', 'app', 'app.js');
const INDEX_PATH = path.join(__dirname, '..', 'app', 'index.html');
const CONFIG_PATH = path.join(__dirname, '..', 'app', 'demo-config.js');
const START_HERE_MD_PATH = path.join(__dirname, '..', 'docs', 'START-HERE.md');
const START_HERE_HTML_PATH = path.join(__dirname, '..', 'docs', 'START-HERE.html');
const README_PATH = path.join(__dirname, '..', 'README.md');
const REQUIRED_UNAVAILABLE_MESSAGE = 'CCN routed-path telemetry is unavailable until a reviewed Guangzhou ingress, CCN route, US private origin, and distinct WSS endpoint are configured and validated.';

function readAppSource() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

test('CCN routed telemetry requires deployment configuration, not query data or ACK metadata', () => {
  const appSource = readAppSource();
  const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');

  assert.doesNotMatch(appSource, /solution1Ws/);
  assert.doesNotMatch(appSource, /solution1_validated/);
  assert.doesNotMatch(appSource, /QUERY\.get\('ccnPathWs'\)/);
  assert.match(appSource, /accelerated: configuredCcnPathWs/);
  assert.match(appSource, /accelerated: new WebSocketAckClient\('accelerated', endpoints\.accelerated\)/);
  assert.match(appSource, /histories\[activeMode\]\.real\.push\(/);
  assert.match(appSource, new RegExp(REQUIRED_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(indexSource, /\?solution1Ws=/);
});

test('public defaults include no live endpoints and configuration loads before app logic', () => {
  const appSource = readAppSource();
  const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
  const configSource = fs.readFileSync(CONFIG_PATH, 'utf8');

  assert.match(indexSource, /<script src="demo-config\.js"><\/script>[\s\S]*<\/head>/);
  assert.match(indexSource, /<script src="app\.js"><\/script>/);
  assert.ok(indexSource.indexOf('demo-config.js') < indexSource.indexOf('app.js'));
  assert.match(appSource, /configuredDirectWs \|\| QUERY\.get\('directWs'\)/);
  assert.match(appSource, /configuredCcnPathWs/);
  assert.match(configSource, /directWs: ""/);
  assert.match(configSource, /ccnPathWs: ""/);
  assert.match(configSource, /defaultMode: "direct"/);
  assert.doesNotMatch(configSource, /jwtencent\.site|\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

test('customer-facing statuses distinguish Direct, routed CCN, unavailable, and simulated states', () => {
  const appSource = readAppSource();

  assert.match(appSource, /ARCHITECTURE WALKTHROUGH/);
  assert.match(appSource, /DIRECT BASELINE CONNECTED/);
  assert.match(appSource, /CCN ROUTED TEST CONNECTED/);
  assert.match(appSource, /CCN ROUTED TEST UNAVAILABLE/);
  assert.match(appSource, /CCN ROUTED TEST PENDING/);
  assert.match(appSource, /configured Guangzhou ingress → CCN → US private-origin WebSocket/);
  assert.match(appSource, /not CCN-link latency or an SLA/);
});

test('new customers have one clear workshop path before technical quick-start material', () => {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startHere = fs.readFileSync(START_HERE_MD_PATH, 'utf8');
  const visualGuide = fs.readFileSync(START_HERE_HTML_PATH, 'utf8');

  assert.match(readme, /## New to CCN\? Start the workshop/);
  assert.match(readme, /Open the beginner workshop guide/);
  assert.match(readme, /You do not need to understand the code or run Local Quick Start first/);
  assert.match(readme, /docs\/START-HERE\.md/);
  assert.match(readme, /docs\/REFERENCE\.md/);
  assert.ok(readme.indexOf('Open the beginner workshop guide') < readme.indexOf('## Why customers consider CCN'));
  assert.match(startHere, /## 1\. Workshop goal/);
  assert.match(startHere, /## 2\. Who this workshop is for/);
  assert.match(startHere, /## 3\. Before you create anything/);
  assert.match(startHere, /### Step 1 — Choose your safe lab design/);
  assert.match(startHere, /### Step 8 — Close the workshop safely/);
  assert.match(startHere, /China Mainland test client/);
  assert.match(startHere, /not a latency benchmark, price quote, SLA test/);
  assert.match(visualGuide, /Build the on-ramp/);
  assert.match(visualGuide, /Start the full workshop/);
});
