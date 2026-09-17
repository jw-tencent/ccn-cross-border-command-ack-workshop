'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const APP_PATH = path.join(__dirname, '..', 'app', 'app.js');
const INDEX_PATH = path.join(__dirname, '..', 'app', 'index.html');
const RUNTIME_CONFIG_EXAMPLE_PATH = path.join(__dirname, '..', 'app', 'runtime-config.example.js');
const GITIGNORE_PATH = path.join(__dirname, '..', '.gitignore');
const START_HERE_MD_PATH = path.join(__dirname, '..', 'docs', 'START-HERE.md');
const CONSOLE_CHECKLIST_PATH = path.join(__dirname, '..', 'docs', 'CONSOLE-CHECKLIST.md');
const TEST_RECORD_TEMPLATE_PATH = path.join(__dirname, '..', 'docs', 'TEST-RECORD-TEMPLATE.md');
const ARCHITECTURE_SVG_PATH = path.join(__dirname, '..', 'docs', 'architecture-overview.svg');
const README_PATH = path.join(__dirname, '..', 'README.md');
const REQUIRED_UNAVAILABLE_MESSAGE = 'CCN routed-path telemetry is unavailable until a reviewed Guangzhou ingress, CCN route, US VPC endpoint, and distinct WSS endpoint are configured and validated.';

function readAppSource() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

test('CCN routed telemetry requires deployment configuration, not query data or ACK metadata', () => {
  const appSource = readAppSource();
  const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');

  assert.doesNotMatch(appSource, /solution1Ws/);
  assert.doesNotMatch(appSource, /solution1_validated/);
  assert.doesNotMatch(appSource, /QUERY\.get\(/);
  assert.doesNotMatch(appSource, /URLSearchParams/);
  assert.match(appSource, /accelerated: configuredCcnPathWs/);
  assert.match(appSource, /accelerated: new WebSocketAckClient\(endpoints\.accelerated\)/);
  assert.match(appSource, /histories\[activeMode\]\.real\.push\(/);
  assert.match(appSource, new RegExp(REQUIRED_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(indexSource, /\?solution1Ws=/);
  assert.doesNotMatch(indexSource, /data-page-node-id=/);
});

test('public client accepts endpoints only from ignored runtime configuration', () => {
  const appSource = readAppSource();
  const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
  const runtimeConfigExample = fs.readFileSync(RUNTIME_CONFIG_EXAMPLE_PATH, 'utf8');
  const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');

  assert.match(indexSource, /<script src="runtime-config\.js"><\/script>[\s\S]*<\/head>/);
  assert.match(indexSource, /<script src="app\.js"><\/script>/);
  assert.ok(indexSource.indexOf('runtime-config.js') < indexSource.indexOf('app.js'));
  assert.doesNotMatch(indexSource, /demo-config\.js/);
  assert.doesNotMatch(appSource, /QUERY\.get\('directWs'\)|QUERY\.get\('ws'\)/);
  assert.match(appSource, /direct: configuredDirectWs/);
  assert.match(appSource, /configuredCcnPathWs/);
  assert.match(gitignore, /^app\/runtime-config\.js$/m);
  assert.match(runtimeConfigExample, /directWs: "wss:\/\/demo\.example\.com\/ws"/);
  assert.match(runtimeConfigExample, /ccnPathWs: "wss:\/\/ccn-path\.example\.com\/ws"/);
  assert.doesNotMatch(runtimeConfigExample, /jwtencent\.site|\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

test('customer-facing statuses distinguish Direct, routed CCN, unavailable, and simulated states', () => {
  const appSource = readAppSource();

  assert.match(appSource, /ARCHITECTURE WALKTHROUGH/);
  assert.match(appSource, /DIRECT BASELINE CONNECTED/);
  assert.match(appSource, /CCN ROUTED TEST CONNECTED/);
  assert.match(appSource, /CCN ROUTED TEST UNAVAILABLE/);
  assert.match(appSource, /CCN ROUTED TEST PENDING/);
  assert.match(appSource, /configured Guangzhou ingress → CCN → US VPC endpoint WebSocket/);
  assert.match(appSource, /not CCN-link latency or an SLA/);
});

test('new customers have one clear workshop path before technical quick-start material', () => {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startHere = fs.readFileSync(START_HERE_MD_PATH, 'utf8');
  const consoleChecklist = fs.readFileSync(CONSOLE_CHECKLIST_PATH, 'utf8');
  const testRecordTemplate = fs.readFileSync(TEST_RECORD_TEMPLATE_PATH, 'utf8');
  const architectureSvg = fs.readFileSync(ARCHITECTURE_SVG_PATH, 'utf8');

  assert.match(readme, /# Tencent Cloud Cloud Connect Network \(CCN\) Beginner Workshop/);
  assert.match(readme, /Official Tencent Cloud CCN documentation: \[English\].*\[Chinese\]/);
  assert.match(readme, /Are you experiencing high latency when visitors in China Mainland access websites or applications hosted overseas\?/);
  assert.match(readme, /## Architecture: China Mainland visitor to overseas application/);
  assert.match(readme, /docs\/architecture-overview\.svg/);
  assert.doesNotMatch(readme, /START-HERE\.html/);
  assert.match(architectureSvg, /<svg/);
  assert.match(architectureSvg, /Guangzhou Ingress/);
  assert.match(architectureSvg, /Cloud Connect/);
  assert.match(architectureSvg, /Silicon Valley VPC/);
  assert.match(readme, /## How CCN supports the optimization design/);
  assert.match(readme, /customer-specific/);
  assert.match(readme, /## New to CCN\? Start the workshop/);
  assert.match(readme, /Open the beginner workshop guide/);
  assert.match(readme, /You do not need to understand the code or run Local Quick Start first/);
  assert.match(readme, /Tencent Cloud Console-first/);
  assert.match(readme, /Do \*\*not\*\* run Terraform at the start/);
  assert.match(readme, /docs\/START-HERE\.md/);
  assert.match(readme, /docs\/REFERENCE\.md/);
  assert.ok(readme.indexOf('Open the beginner workshop guide') < readme.indexOf('## Why customers consider CCN'));
  assert.match(startHere, /## 1\. Workshop goal/);
  assert.match(startHere, /## 2\. Who this workshop is for/);
  assert.match(startHere, /## 3\. Beginner launchpad: choose your role before you build/);
  assert.match(startHere, /Readiness gate — do not create resources until every item has an owner/);
  assert.match(startHere, /## 4\. Before you create anything/);
  assert.match(startHere, /CONSOLE-CHECKLIST\.md/);
  assert.match(startHere, /TEST-RECORD-TEMPLATE\.md/);
  assert.match(startHere, /Hard eligibility gate for this Guangzhou–Silicon Valley lab/);
  assert.match(startHere, /postpaid-by-bandwidth/);
  assert.match(startHere, /ALLOWED_ORIGINS=https:\/\/DIRECT_HOST/);
  assert.match(startHere, /runtime-config\.js/);
  assert.match(startHere, /### Step 1 — Choose your safe lab design/);
  assert.match(startHere, /### Step 8 — Close the workshop safely/);
  assert.match(startHere, /China Mainland test client/);
  assert.match(startHere, /not a latency benchmark, price quote, SLA test/);
  assert.match(startHere, /Console first, Terraform later/);
  assert.match(readme, /Console build checklist/);
  assert.match(readme, /configuration examples, so GitHub displays them as code/);
  assert.match(consoleChecklist, /## 4\. CCN and private-path gate/);
  assert.match(consoleChecklist, /do not enable routed WSS yet/i);
  assert.match(testRecordTemplate, /functional application-path validation/);
  assert.match(testRecordTemplate, /does not create a latency benchmark, CCN-link measurement, SLA statement, or performance guarantee/);
});
