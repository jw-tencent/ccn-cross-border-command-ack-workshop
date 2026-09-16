(() => {
  'use strict';

  /** @typedef {'direct'|'accelerated'} PathMode */
  /** @typedef {'simulated'|'real'} TelemetrySource */
  /** @typedef {{commandId: string, ackId: string, completedAt: number, source: TelemetrySource, rttMs?: number, outcome?: string, routeId?: string, routeStatus?: string}} CommandSample */

  const MAX_COMMANDS = 10;
  const TRACE_STEP_DURATION_MS = 420;
  const ACK_TIMEOUT_MS = 10_000;
  const QUERY = new URLSearchParams(window.location.search);
  const deploymentConfig = window.CCN_DEMO_CONFIG && typeof window.CCN_DEMO_CONFIG === 'object' ? window.CCN_DEMO_CONFIG : {};
  const configuredDirectWs = typeof deploymentConfig.directWs === 'string' ? deploymentConfig.directWs.trim() : '';
  const configuredCcnPathWs = typeof deploymentConfig.ccnPathWs === 'string' ? deploymentConfig.ccnPathWs.trim() : '';
  const configuredDefaultMode = deploymentConfig.defaultMode === 'accelerated' ? 'accelerated' : 'direct';
  const routeLock = QUERY.get('route') === 'direct' ? 'direct' : null;
  const endpoints = {
    /* Direct keeps local-debug query compatibility. The CCN endpoint is deployment-config only. */
    direct: configuredDirectWs || QUERY.get('directWs') || QUERY.get('ws') || '',
    accelerated: configuredCcnPathWs,
  };
  const CCN_PATH_UNAVAILABLE = 'CCN routed-path telemetry is unavailable until a reviewed Guangzhou ingress, CCN route, US private origin, and distinct WSS endpoint are configured and validated.';

  const MODES = {
    direct: {
      label: 'Public Internet Direct', tag: 'DIRECT',
      summary: 'Public Internet Direct: game commands travel through an opaque Public Internet path to the Same US Origin; no controlled three-segment path.',
      traceSteps: [
        { key: 'client', text: 'A simulated game command has been sent from the China Mainland Client.' },
        { key: 'public', text: 'The simulated game command is crossing the opaque Public Internet.' },
        { key: 'origin', text: 'The Same US Origin received the simulated game command and is returning a simulated ACK.' },
        { key: 'return', text: 'The simulated ACK returned to the China Mainland Client through the public path.' },
      ],
    },
    accelerated: {
      label: 'CCN Cross-Border Bandwidth Path', tag: 'CCN PATH',
      summary: 'A designed logical path: China Mainland ingress, CCN Cross-Border Bandwidth, and a US private origin. Without a configured routed endpoint, this view remains simulated.',
      traceSteps: [
        { key: 'client', text: 'A simulated game command has been sent from the China Mainland Client.' },
        { key: 'ingress', text: 'Stage 1: Guangzhou EIP and ingress CVM are processing the simulated game command.' },
        { key: 'ccn', text: 'Stage 2: CCN Cross-Border Bandwidth is simulated in transit.' },
        { key: 'egress', text: 'Stage 3: The US private-origin segment is processing the simulated game command.' },
        { key: 'origin', text: 'The Same US Origin received the simulated game command and is returning a simulated ACK.' },
        { key: 'return', text: 'The simulated ACK returned to the China Mainland Client through the configured logical path.' },
      ],
    },
  };

  /** @type {PathMode} */
  let activeMode = routeLock || (configuredDefaultMode === 'accelerated' && configuredCcnPathWs ? 'accelerated' : (configuredDirectWs ? 'direct' : 'accelerated'));
  /** @type {'idle'|'pending'|'complete'} */
  let commandState = 'idle';
  let batchActive = false;
  /** @type {Record<PathMode, Record<TelemetrySource, CommandSample[]>>} */
  const histories = {
    direct: { simulated: [], real: [] },
    accelerated: { simulated: [], real: [] },
  };

  const elements = {
    fireButton: document.querySelector('#fire-command-button'), batchButton: document.querySelector('#batch-command-button'),
    resetButton: document.querySelector('#reset-button'), commandNumber: document.querySelector('#command-number'),
    commandStageTitle: document.querySelector('#command-stage-title'), commandStageCopy: document.querySelector('#command-stage-copy'),
    ackOverlay: document.querySelector('#ack-overlay'), liveAck: document.querySelector('#live-ack'), liveFlow: document.querySelector('#live-flow'),
    latestTotal: document.querySelector('#latest-total'), latestCommand: document.querySelector('#latest-command'), latestAck: document.querySelector('#latest-ack'),
    latestStatus: document.querySelector('#latest-status'), ackCount: document.querySelector('#ack-count'), resultModeTag: document.querySelector('#result-mode-tag'),
    sampleCount: document.querySelector('#sample-count'), metricSent: document.querySelector('#metric-sent'), metricAck: document.querySelector('#metric-ack'),
    metricSentDetail: document.querySelector('#metric-sent-detail'), metricAckDetail: document.querySelector('#metric-ack-detail'),
    metricCap: document.querySelector('#metric-cap'), announcement: document.querySelector('#command-announcement'),
    modeButtons: Array.from(document.querySelectorAll('.path-button')), liveTrace: document.querySelector('#live-trace'),
    traceModeTag: document.querySelector('#trace-mode-tag'), traceTitle: document.querySelector('#trace-title'), traceSummary: document.querySelector('#trace-summary'),
    traceStatus: document.querySelector('#trace-status'), traceSourceLabel: document.querySelector('#trace-source-label'),
    traceRoutes: Array.from(document.querySelectorAll('.trace-route')),
    telemetryBadge: document.querySelector('#telemetry-source-badge'), telemetryConnection: document.querySelector('#telemetry-connection'),
    telemetryDetail: document.querySelector('#telemetry-detail'), telemetryBoundary: document.querySelector('#telemetry-boundary'),
    resultReadoutLabel: document.querySelector('#result-readout-label'), resultDetailLabel: document.querySelector('#result-detail-label'),
    resultCountLabel: document.querySelector('#result-count-label'), metricsKicker: document.querySelector('#metrics-kicker'),
    metricsNote: document.querySelector('#metrics-note'), globalDemoBadge: document.querySelector('#global-demo-badge'),
    deploymentStatus: document.querySelector('.deployment-status'), deploymentStatusLabel: document.querySelector('#deployment-status-label'),
    deploymentStatusCopy: document.querySelector('#deployment-status-copy'),
  };

  /** @param {string} endpoint @returns {boolean} */
  function isSafeWebSocketEndpoint(endpoint) {
    try {
      const parsed = new URL(endpoint);
      return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
    } catch {
      return false;
    }
  }

  /** @returns {string} */
  function makeEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }

  /** @param {number} milliseconds @returns {Promise<void>} */
  function wait(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }

  /** @param {string} message */
  function announce(message) {
    elements.announcement.textContent = '';
    window.setTimeout(() => { elements.announcement.textContent = message; }, 25);
  }

  class WebSocketAckClient {
    /** @param {PathMode} mode @param {string} endpoint */
    constructor(mode, endpoint) {
      this.mode = mode;
      this.endpoint = endpoint;
      this.socket = null;
      this.status = isSafeWebSocketEndpoint(endpoint) ? 'connecting' : 'not_configured';
      this.detail = isSafeWebSocketEndpoint(endpoint) ? 'Connecting to the configured endpoint; the endpoint is not displayed.' : 'No endpoint was provided.';
      this.routeId = '';
      this.routeStatus = '';
      /** @type {Map<string, {resolve: (value: object) => void, reject: (reason: Error) => void, timer: number}>} */
      this.pending = new Map();
      if (isSafeWebSocketEndpoint(endpoint)) this.connect();
    }

    connect() {
      try {
        this.socket = new WebSocket(this.endpoint);
      } catch {
        this.status = 'error';
        this.detail = 'The endpoint is invalid or the browser cannot create a WebSocket. Remove the parameter to use simulation mode.';
        render();
        return;
      }
      this.status = 'connecting';
      this.socket.addEventListener('open', () => {
        this.status = 'connected';
        this.detail = 'Connected. A real Command-to-ACK round-trip application acknowledgement is recorded only after a matching ACK.';
        render();
      });
      this.socket.addEventListener('message', (event) => this.handleMessage(event));
      this.socket.addEventListener('error', () => {
        if (this.status !== 'closed') {
          this.status = 'error';
          this.detail = 'WebSocket connection error; no real sample is recorded. Refresh manually to reconnect.';
          render();
        }
      });
      this.socket.addEventListener('close', () => {
        const wasError = this.status === 'error';
        this.status = 'closed';
        this.detail = wasError ? this.detail : 'WebSocket disconnected; it will not reconnect automatically. Refresh manually to reconnect.';
        this.rejectPending(new Error('WebSocket disconnected before ACK.'));
        render();
      });
    }

    /** @param {MessageEvent} event */
    handleMessage(event) {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (!message || typeof message !== 'object' || typeof message.eventId !== 'string') return;
      if (typeof message.routeId === 'string') this.routeId = message.routeId;
      if (typeof message.routeStatus === 'string') this.routeStatus = message.routeStatus;
      const pending = this.pending.get(message.eventId);
      if (!pending) { render(); return; }
      window.clearTimeout(pending.timer);
      this.pending.delete(message.eventId);
      if (message.type === 'ack' && message.schemaVersion === 1) pending.resolve(message);
      else if (message.type === 'server_error') pending.reject(new Error(message.message || 'Server rejected command.'));
      else pending.reject(new Error('Unexpected server response.'));
      render();
    }

    /** @param {Error} error */
    rejectPending(error) {
      this.pending.forEach((pending) => { window.clearTimeout(pending.timer); pending.reject(error); });
      this.pending.clear();
    }

    /** @param {object} command @returns {Promise<object>} */
    send(command) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Real WebSocket endpoint is not connected.'));
      }
      const eventId = command.eventId;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          this.pending.delete(eventId);
          reject(new Error(`ACK timed out after ${ACK_TIMEOUT_MS / 1000} seconds.`));
        }, ACK_TIMEOUT_MS);
        this.pending.set(eventId, { resolve, reject, timer });
        try { this.socket.send(JSON.stringify(command)); } catch {
          window.clearTimeout(timer);
          this.pending.delete(eventId);
          reject(new Error('Could not send the command to the WebSocket.'));
        }
      });
    }
  }

  const clients = {
    direct: new WebSocketAckClient('direct', endpoints.direct),
    accelerated: new WebSocketAckClient('accelerated', endpoints.accelerated),
  };

  /** @returns {WebSocketAckClient} */
  function activeClient() { return clients[activeMode]; }

  /** @returns {TelemetrySource} */
  function selectedSource() {
    return activeClient().status === 'connected' ? 'real' : 'simulated';
  }

  /** @returns {boolean} */
  function shouldUseRealEndpointForCommand() {
    return activeClient().status === 'connected';
  }

  /** @returns {CommandSample[]} */
  function activeHistory() { return histories[activeMode][selectedSource()]; }
  /** @returns {number} */
  function remainingCommands() { return Math.max(0, MAX_COMMANDS - activeHistory().length); }

  function resetTraceNodes() {
    elements.traceRoutes.forEach((route) => route.querySelectorAll('.trace-node').forEach((node) => node.classList.remove('is-active', 'is-complete', 'is-returning')));
  }
  /** @param {string} status */
  function setTraceStatus(status) { elements.traceStatus.textContent = status; }

  function telemetryDescription() {
    const client = activeClient();
    if (activeMode === 'direct') {
      if (client.status === 'connected') return { badge: 'REAL DIRECT ACK RTT', connection: 'Real Direct WebSocket Command-to-ACK connected', detail: client.detail, boundary: 'A real browser performance.now() round trip is recorded as application acknowledgement RTT only after a matching ACK. It is not network latency, one-way latency, an SLA, or CCN Cross-Border Bandwidth performance.' };
      if (isSafeWebSocketEndpoint(endpoints.direct)) return { badge: 'DIRECT REAL UNAVAILABLE', connection: 'Direct endpoint is not connected', detail: client.detail, boundary: 'When disconnected, the simulated architecture behavior remains; no fabricated metric is generated or shown.' };
      return { badge: 'SIMULATED FALLBACK', connection: 'No Direct endpoint configured', detail: 'The static demo uses the existing simulated Command-to-ACK lifecycle.', boundary: 'Without a real WebSocket endpoint, no network request is made and no real RTT is generated.' };
    }
    if (client.status === 'connected') return {
      badge: 'REAL ROUTED ACK RTT',
      connection: 'Configured Guangzhou ingress → CCN → US private-origin WebSocket connected',
      detail: client.detail,
      boundary: 'A real browser Command-to-ACK application acknowledgement RTT is recorded through the configured routed endpoint only after a matching ACK. It is not one-way latency, CCN-link latency, throughput, jitter, packet loss, an SLA, or a performance guarantee.',
    };
    if (isSafeWebSocketEndpoint(endpoints.accelerated)) return {
      badge: 'CCN ROUTED ENDPOINT UNAVAILABLE',
      connection: 'Configured routed endpoint is not connected',
      detail: client.detail,
      boundary: 'No successful routed-path sample is recorded until a matching ACK is received. The endpoint URL and ACK metadata alone are not a performance claim.',
    };
    return {
      badge: 'CCN PATH REAL UNAVAILABLE',
      connection: CCN_PATH_UNAVAILABLE,
      detail: 'The CCN routed endpoint is deployment-config only; query parameters and self-reported ACK metadata cannot activate it.',
      boundary: 'Without a reviewed and configured routed endpoint, CCN Cross-Border Bandwidth remains an architecture demonstration and no real RTT is generated.',
    };
  }

  function renderTraceMode() {
    const mode = MODES[activeMode];
    const source = selectedSource();
    const routedConnected = activeMode === 'accelerated' && clients.accelerated.status === 'connected';
    elements.liveTrace.className = `trace-panel mode-${activeMode}`;
    elements.traceModeTag.className = `path-tag ${activeMode}`;
    elements.traceModeTag.textContent = mode.tag;
    elements.traceTitle.textContent = `Current: ${mode.label}`;
    elements.traceSummary.textContent = routedConnected
      ? 'Configured routed endpoint: browser → Guangzhou ingress → CCN Cross-Border Bandwidth → US private origin. Real samples are browser Command-to-ACK application acknowledgement RTT only.'
      : mode.summary;
    elements.traceRoutes.forEach((route) => { route.hidden = route.dataset.route !== activeMode; });
    elements.traceSourceLabel.textContent = source === 'real' ? (activeMode === 'accelerated' ? 'REAL ROUTED ACK' : 'REAL DIRECT ACK') : 'SIMULATED';
    if (commandState !== 'pending') setTraceStatus(source === 'real' ? 'Real ACK ready: only a matching Command-to-ACK round-trip application acknowledgement is recorded.' : 'Path ready: send a game command to display the simulated Command-to-ACK return state.');
  }

  function updateTelemetryPanel() {
    const description = telemetryDescription();
    elements.telemetryBadge.textContent = description.badge;
    elements.telemetryConnection.textContent = description.connection;
    elements.telemetryDetail.textContent = description.detail;
    elements.telemetryBoundary.textContent = description.boundary;
    if (clients.direct.status === 'connected' && clients.accelerated.status === 'connected') elements.globalDemoBadge.textContent = 'REAL DIRECT ACK / REAL ROUTED ACK';
    else if (clients.accelerated.status === 'connected') elements.globalDemoBadge.textContent = 'CCN PATH · REAL ROUTED ACK';
    else if (clients.direct.status === 'connected') elements.globalDemoBadge.textContent = 'REAL DIRECT ACK / CCN PATH SIMULATED';
    else elements.globalDemoBadge.textContent = 'CCN PATH · SIMULATED';
  }

  function updateDeploymentStatus() {
    const status = elements.deploymentStatus;
    if (!status || !elements.deploymentStatusLabel || !elements.deploymentStatusCopy) return;
    status.classList.remove('is-direct-connected', 'is-ccn-pending');
    if (activeMode === 'accelerated') {
      if (clients.accelerated.status === 'connected') {
        status.classList.add('is-direct-connected');
        elements.deploymentStatusLabel.textContent = 'CCN ROUTED TEST CONNECTED';
        elements.deploymentStatusCopy.textContent = 'The configured Guangzhou ingress → CCN → US private-origin WebSocket is connected. A sample is recorded only after a matching ACK; it is application acknowledgement RTT, not CCN-link latency or an SLA.';
        return;
      }
      if (isSafeWebSocketEndpoint(endpoints.accelerated)) {
        elements.deploymentStatusLabel.textContent = 'CCN ROUTED TEST UNAVAILABLE';
        elements.deploymentStatusCopy.textContent = 'The configured routed endpoint is not connected. No successful routed-path sample will be recorded until a matching server acknowledgement is received.';
        return;
      }
      status.classList.add('is-ccn-pending');
      elements.deploymentStatusLabel.textContent = 'CCN ROUTED TEST PENDING';
      elements.deploymentStatusCopy.textContent = 'No reviewed routed endpoint is configured. CCN remains an architecture demonstration and no real routed-path sample can be recorded.';
      return;
    }
    if (clients.direct.status === 'connected') {
      status.classList.add('is-direct-connected');
      elements.deploymentStatusLabel.textContent = 'DIRECT BASELINE CONNECTED';
      elements.deploymentStatusCopy.textContent = 'Direct WebSocket is connected. A sample is recorded only after a matching server acknowledgement; it is an application ACK RTT, not a network latency or SLA measurement.';
      return;
    }
    if (isSafeWebSocketEndpoint(endpoints.direct)) {
      elements.deploymentStatusLabel.textContent = 'DIRECT BASELINE UNAVAILABLE';
      elements.deploymentStatusCopy.textContent = 'A Direct endpoint is configured but not connected. No successful sample will be recorded until a matching server acknowledgement is received.';
      return;
    }
    elements.deploymentStatusLabel.textContent = 'ARCHITECTURE WALKTHROUGH';
    elements.deploymentStatusCopy.textContent = 'No live Direct endpoint is configured. This page is currently an architecture walkthrough.';
  }

  function updateModeControls() {
    const isBusy = commandState === 'pending';
    elements.modeButtons.forEach((button) => {
      const isSelected = button.dataset.mode === activeMode;
      const locked = routeLock === 'direct' && button.dataset.mode !== 'direct';
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-checked', String(isSelected));
      button.disabled = isBusy || locked;
      button.querySelector('.mode-state').textContent = locked ? 'Locked to Direct' : (isSelected ? 'Selected' : 'Select');
    });
    elements.resultModeTag.textContent = MODES[activeMode].tag;
    elements.resultModeTag.className = `path-tag ${activeMode}`;
  }

  function updateControls() {
    const remaining = remainingCommands();
    const isBusy = commandState === 'pending';
    const isComplete = remaining === 0;
    elements.fireButton.disabled = isBusy || isComplete;
    elements.batchButton.disabled = isBusy || isComplete;
    elements.resetButton.disabled = isBusy;
    if (isBusy) {
      const completed = activeHistory().length;
      elements.fireButton.textContent = 'COMMAND IN FLIGHT';
      elements.batchButton.textContent = batchActive ? `RUNNING ${completed} / ${MAX_COMMANDS} / RUNNING` : 'BATCH TEST PAUSED / SINGLE COMMAND IN FLIGHT';
      return;
    }
    const sourceText = selectedSource() === 'real' ? 'REAL ACK' : 'SIMULATED';
    elements.fireButton.innerHTML = `FIRE COMMAND <span>/ ${sourceText}</span>`;
    elements.batchButton.innerHTML = isComplete ? `10 COMMANDS CONFIRMED / CURRENT SOURCE COMPLETE` : `RUN 10-COMMAND TEST <span>/ RUN ${remaining} REMAINING COMMANDS</span>`;
  }

  function updateCommandNumber() { elements.commandNumber.textContent = String(Math.min(activeHistory().length + 1, MAX_COMMANDS)).padStart(2, '0'); }

  function updateResults() {
    const source = selectedSource();
    const samples = activeHistory();
    const latest = samples.at(-1);
    const sourceName = source === 'real' ? (activeMode === 'accelerated' ? 'REAL ROUTED ACK RTT' : 'REAL DIRECT ACK RTT') : 'SIMULATED ACK';
    elements.resultReadoutLabel.textContent = sourceName;
    elements.resultDetailLabel.textContent = source === 'real' ? (activeMode === 'accelerated' ? 'ACK EVENT / ROUTED' : 'ACK EVENT / DIRECT') : 'ACK EVENT / SIMULATED';
    elements.resultCountLabel.textContent = source === 'real' ? 'Confirmed real application ACKs' : 'Confirmed simulated ACKs';
    elements.metricsKicker.textContent = source === 'real' ? 'REAL APP ACK RTT SAMPLES / REAL APPLICATION ACK SAMPLES' : 'SIMULATED ACK SAMPLES / SIMULATED ACK SAMPLES';
    elements.sampleCount.textContent = `${samples.length} / ${MAX_COMMANDS}`;
    elements.ackCount.textContent = String(samples.length);
    elements.metricSent.textContent = String(samples.length);
    elements.metricAck.textContent = String(samples.length);
    elements.metricSentDetail.textContent = source === 'real' ? 'matched WebSocket commands' : 'accepted for simulated flow';
    elements.metricAckDetail.textContent = source === 'real' ? 'real application ACK confirmations' : 'simulated ACK confirmations';
    elements.metricCap.textContent = String(MAX_COMMANDS);
    elements.metricsNote.textContent = source === 'real'
      ? `Each real sample is the browser performance.now() application acknowledgement round trip from sending a command to receiving a matching server ACK${activeMode === 'accelerated' ? ' through the configured routed endpoint' : ''}. It is not network latency, one-way latency, CCN-link latency, throughput, jitter, packet loss, an SLA, or a performance guarantee.`
      : 'Counts update only after the simulated ACK lifecycle completes. No latency, throughput, jitter, packet loss, or production-performance value is shown or derived.';
    if (!latest) {
      elements.latestTotal.textContent = '—'; elements.latestCommand.textContent = '—'; elements.latestAck.textContent = '—'; elements.latestStatus.textContent = 'Waiting to send'; return;
    }
    elements.latestTotal.textContent = source === 'real' ? `${latest.rttMs.toFixed(2)} ms` : 'ACK confirmed';
    elements.latestCommand.textContent = latest.commandId;
    elements.latestAck.textContent = latest.ackId;
    elements.latestStatus.textContent = source === 'real'
      ? (activeMode === 'accelerated' ? `${latest.outcome} · configured Guangzhou → CCN → US route · server ACK: ${latest.routeId}/${latest.routeStatus}` : `${latest.outcome} · ${latest.routeId} · ${latest.routeStatus}`)
      : 'Simulated ACK lifecycle complete';
  }

  function render() { updateTelemetryPanel(); updateDeploymentStatus(); updateModeControls(); updateControls(); updateCommandNumber(); updateResults(); renderTraceMode(); }

  /** @param {string} stepKey @param {boolean} isReturn */
  function markTraceStep(stepKey, isReturn) {
    const route = elements.traceRoutes.find((item) => item.dataset.route === activeMode);
    if (!route) return;
    route.querySelectorAll('.is-active').forEach((node) => node.classList.replace('is-active', 'is-complete'));
    const node = route.querySelector(`[data-step="${isReturn ? 'client' : stepKey}"]`);
    if (node) node.classList.add(isReturn ? 'is-returning' : 'is-active');
  }

  async function runSimulatedTrace() {
    const steps = MODES[activeMode].traceSteps;
    resetTraceNodes();
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]; markTraceStep(step.key, step.key === 'return'); setTraceStatus(step.text);
      elements.liveFlow.textContent = `Simulated step ${index + 1}/${steps.length}`;
      await wait(TRACE_STEP_DURATION_MS);
    }
  }

  /** @param {number} commandNumber @returns {Promise<boolean>} */
  async function sendRealCommand(commandNumber) {
    const client = activeClient();
    const commandId = `CMD-${String(commandNumber).padStart(2, '0')}`;
    const eventId = makeEventId();
    const startedAt = performance.now();
    const response = await client.send({ type: 'game_command', eventId, command: 'fire', clientSentMonoMs: startedAt, schemaVersion: 1 });
    const rttMs = performance.now() - startedAt;
    histories[activeMode].real.push({ commandId, ackId: eventId, completedAt: Date.now(), source: 'real', rttMs, outcome: response.outcome, routeId: response.routeId, routeStatus: response.routeStatus });
    elements.liveAck.textContent = `ACK confirmed / ${rttMs.toFixed(2)} ms`;
    elements.liveFlow.textContent = activeMode === 'accelerated' ? 'Real routed application ACK confirmed' : 'Real Direct application ACK confirmed';
    setTraceStatus('Matching server ACK received: recorded as a real Command-to-ACK round-trip application acknowledgement, not network latency or an SLA.');
    announce(`${commandId} received a real ${activeMode === 'accelerated' ? 'routed' : 'Direct'} application ACK; RTT ${rttMs.toFixed(2)} ms.`);
    return true;
  }

  /** @returns {Promise<boolean>} */
  async function sendOneCommand() {
    if (commandState === 'pending' || remainingCommands() === 0) return false;
    commandState = 'pending';
    const sourceAtStart = shouldUseRealEndpointForCommand() ? 'real' : 'simulated';
    const commandNumber = activeHistory().length + 1;
    const commandId = `CMD-${String(commandNumber).padStart(2, '0')}`;
    elements.ackOverlay.hidden = false; elements.ackOverlay.setAttribute('aria-hidden', 'false');
    elements.commandStageTitle.textContent = `Sending ${commandId}`;
    elements.commandStageCopy.textContent = sourceAtStart === 'real' ? 'Waiting for a matching real server ACK; no sample is recorded on timeout or failure.' : 'Shows the simulated game command, same US origin ACK, and return path stage by stage; it is not a real network measurement.';
    elements.liveAck.textContent = sourceAtStart === 'real' ? 'Waiting for real ACK' : 'Waiting for simulated ACK';
    elements.liveFlow.textContent = sourceAtStart === 'real' ? 'WebSocket command sent' : 'Simulated path started';
    render();
    let recorded = false;
    try {
      if (sourceAtStart === 'real') recorded = await sendRealCommand(commandNumber);
      else {
        await runSimulatedTrace();
        const ackId = `SIM-ACK-${String(commandNumber).padStart(2, '0')}`;
        histories[activeMode].simulated.push({ commandId, ackId, completedAt: Date.now(), source: 'simulated' });
        elements.liveAck.textContent = 'ACK confirmed / simulated'; elements.liveFlow.textContent = 'Simulated path complete';
        setTraceStatus('Simulated ACK returned. This state machine demonstrates architecture; it is not real CCN, CVM, WebSocket, or origin telemetry.');
        announce(`${commandId} received ${ackId}. Only a simulated ACK confirmation is recorded, with no performance timing.`);
        recorded = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ACK error.';
      elements.liveAck.textContent = 'ACK not confirmed / no sample'; elements.liveFlow.textContent = 'Real command failed';
      setTraceStatus(`Real ACK not confirmed: ${message}. No sample is recorded.`);
      announce(`${commandId} did not receive a real ACK: ${message}. No sample was recorded.`);
    }
    commandState = remainingCommands() === 0 ? 'complete' : 'idle';
    elements.ackOverlay.hidden = true; elements.ackOverlay.setAttribute('aria-hidden', 'true');
    elements.commandStageTitle.textContent = recorded ? (commandState === 'complete' ? '10 commands confirmed for the current source' : 'ACK confirmed') : 'No ACK sample recorded';
    elements.commandStageCopy.textContent = recorded ? 'You can send the next game command or run an automated test for the remaining commands.' : `The real ${activeMode === 'accelerated' ? 'routed' : 'Direct'} endpoint failed. Check the connection and refresh manually to retry, or use the simulated path. No successful sample was recorded.`;
    render();
    return recorded;
  }

  async function runBatchTest() {
    if (commandState === 'pending' || remainingCommands() === 0) return;
    batchActive = true;
    const totalToRun = remainingCommands();
    announce(`Starting the batch test: ${totalToRun} remaining commands will be sent on the current ${MODES[activeMode].label} source.`);
    while (batchActive && remainingCommands() > 0) {
      const commandRecorded = await sendOneCommand();
      if (!commandRecorded) break;
    }
    batchActive = false;
    if (commandState !== 'complete') commandState = 'idle';
    render();
    announce(`Batch test complete: the current ${MODES[activeMode].label} source confirmed ${activeHistory().length} samples.`);
  }

  /** @param {PathMode} mode */
  function selectMode(mode) {
    if (mode === activeMode || commandState === 'pending' || (routeLock === 'direct' && mode !== 'direct')) return;
    activeMode = mode; commandState = remainingCommands() === 0 ? 'complete' : 'idle'; batchActive = false;
    elements.ackOverlay.hidden = true; elements.ackOverlay.setAttribute('aria-hidden', 'true');
    elements.commandStageTitle.textContent = `Current: ${MODES[mode].label}`;
    elements.commandStageCopy.textContent = mode === 'direct'
      ? 'Use the fixed command button to send one command. A connected Direct endpoint records a real application ACK RTT; otherwise the page shows the simulated lifecycle.'
      : (clients.accelerated.status === 'connected'
        ? 'Use the fixed command button to send one command through the configured Guangzhou ingress → CCN → US private-origin endpoint.'
        : 'Use the fixed command button to show the simulated CCN architecture lifecycle until the configured routed endpoint connects.');
    elements.liveAck.textContent = 'Waiting for command'; elements.liveFlow.textContent = 'Path ready'; render();
    announce(`Switched to ${MODES[mode].label}. Simulated and real ACK histories remain isolated by path and source.`);
  }

  function resetCurrentMode() {
    if (commandState === 'pending') return;
    const source = selectedSource(); histories[activeMode][source] = []; commandState = 'idle'; batchActive = false;
    elements.ackOverlay.hidden = true; elements.ackOverlay.setAttribute('aria-hidden', 'true');
    elements.commandStageTitle.textContent = `Reset ${source === 'real' ? 'real' : 'simulated'} samples for ${MODES[activeMode].label}`;
    elements.commandStageCopy.textContent = 'You can send one game command or run the remaining commands for the current source.';
    elements.liveAck.textContent = 'Waiting for command'; elements.liveFlow.textContent = 'Current source reset'; render();
  }

  elements.fireButton.addEventListener('click', () => { void sendOneCommand(); });
  elements.batchButton.addEventListener('click', () => { void runBatchTest(); });
  elements.resetButton.addEventListener('click', resetCurrentMode);
  elements.modeButtons.forEach((button) => button.addEventListener('click', () => selectMode(/** @type {PathMode} */ (button.dataset.mode))));
  render();
})();
