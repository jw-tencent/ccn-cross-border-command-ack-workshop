# Command-to-ACK protocol v1

## Transport

- Browser transport: RFC 6455 WebSocket to `GET /ws` after an HTTP Upgrade.
- Public deployments should use `wss://` with TLS terminated by a reviewed reverse proxy.
- The Node service accepts only text JSON frames up to `MAX_PAYLOAD_BYTES` (maximum 64 KiB).
- The browser `Origin` must be an exact member of `ALLOWED_ORIGINS`. Wildcards are rejected.

## Client command

```json
{
  "type": "game_command",
  "eventId": "4bc6c6a8-4334-46a7-9f4f-ecf591d4368b",
  "command": "fire",
  "clientSentMonoMs": 246.381,
  "schemaVersion": 1
}
```

| Field | Rule |
|---|---|
| `type` | exactly `game_command` |
| `eventId` | session-unique safe identifier, 1-128 characters from `A-Za-z0-9._:-` |
| `command` | safe identifier, 1-64 characters from `A-Za-z0-9_-` |
| `clientSentMonoMs` | finite browser `performance.now()` value; process-local diagnostic only |
| `schemaVersion` | exactly `1` |

The server performs short-lived per-session `(session, eventId)` deduplication. A same-session retry returns `outcome: "duplicate"`; a reconnect starts a new session.

## ACK

```json
{
  "type": "ack",
  "eventId": "4bc6c6a8-4334-46a7-9f4f-ecf591d4368b",
  "outcome": "accepted",
  "routeId": "same-us-origin-direct",
  "routeStatus": "direct_ack_only",
  "serverReceivedMonoMs": 7280.114,
  "serverAckSentMonoMs": 7280.145,
  "schemaVersion": 1
}
```

The included service always returns the immutable service identity `same-us-origin-direct` / `direct_ack_only`. It identifies the ACK service and does **not** prove the browser ingress path or CCN route.

The browser determines the display label from the separately reviewed endpoint configuration. A configured routed endpoint can produce a **routed application ACK RTT** only after a matching ACK. This still does not establish one-way latency, CCN-link latency, or an SLA.

## Error behavior

A malformed or unsafe frame is rejected and closed. Malformed UTF-8/JSON, unmasked client frames, fragmented frames, binary frames, unsupported opcodes, and oversized payloads are not interpreted as commands. The service replies to supported ping frames with pong.
