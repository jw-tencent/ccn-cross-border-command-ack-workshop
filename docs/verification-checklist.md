# CCN demo configuration and verification checklist

Use this document as the go/no-go checklist before switching the public demo from architecture walkthrough to real endpoint testing.

## Stage 0 — Local application check

| Check | How to verify | Expected result |
|---|---|---|
| Syntax, unit, and protocol smoke tests | `npm run smoke` | All tests pass |
| Local ACK health | `curl -s http://127.0.0.1:8787/healthz` | JSON with `status: "ok"` |
| Local Direct browser flow | Open the local page with `?ws=ws://127.0.0.1:8787/ws` | One command produces one matched Direct ACK sample |
| Routed safety boundary | Add `?ccnPathWs=...` to the URL | It must not activate routed telemetry |

## Stage 1 — US Direct baseline

| Check | How to verify | Expected result |
|---|---|---|
| Node listener | On the US CVM, query `http://127.0.0.1:8787/healthz` | Healthy local service |
| Static web-root safety | Request a non-public path such as `/server/server.js` | `404`; only browser assets are public |
| Public TLS | Open `https://demo.example.com` | Valid certificate and static page loads |
| Direct WSS | Set `directWs` to `wss://demo.example.com/ws` | UI shows `DIRECT BASELINE CONNECTED` |
| Direct ACK test | Run ten sequential commands | Ten matching ACKs; preserve failure count if any |

## Stage 2 — Guangzhou ingress and CCN private path

| Check | How to verify | Expected result |
|---|---|---|
| CIDR separation | Compare Guangzhou and US VPC CIDRs | No overlap |
| CCN association | CCN console: both VPCs are associated | Both associations are active/accepted |
| CCN routes | CCN and VPC route views | Each VPC has a valid route toward the other VPC CIDR; no conflicting range is selected |
| Approval and bandwidth | Current CCN console and approved business workflow | Applicable cross-border compliance and bandwidth steps are complete |
| US private health from Guangzhou | `curl --resolve demo.example.com:443:US_PRIVATE_IP https://demo.example.com/healthz` | Expected health JSON over the private path |
| Guangzhou public TLS | Open `https://ccn-path.example.com/healthz` | Expected health response; root `/` may intentionally return `404` |
| Routed WSS proxy | Confirm Nginx has Upgrade headers and upstream TLS/SNI verification | `/ws` reaches the US private origin without disabling verification |

## Stage 3 — Enable the routed demo endpoint

Only after Stage 2 is complete, create a **deployment-time** configuration file:

```js
window.CCN_DEMO_CONFIG = Object.freeze({
  directWs: "wss://demo.example.com/ws",
  ccnPathWs: "wss://ccn-path.example.com/ws",
  defaultMode: "direct",
});
```

Then verify:

| Check | Expected result |
|---|---|
| Select CCN Cross-Border Bandwidth | UI shows `CCN ROUTED TEST CONNECTED` |
| Send one command | UI records `REAL ROUTED ACK RTT` after a matching ACK |
| Force a routed endpoint failure | UI shows unavailable/pending state and records no successful routed RTT |
| Reset Direct history | Routed history remains unchanged |
| Reset routed history | Direct history remains unchanged |

## Stage 4 — Customer-relevant test conditions

For a Direct versus routed comparison, keep these constant:

- China Mainland client and network;
- browser and browser version;
- command payload, count, and sequence;
- US application origin and backend version; and
- test time window.

A US or other overseas test client is useful for functional setup checks. It is **not** a substitute for a China Mainland client when discussing user experience for China Mainland access.

## Common outcomes and next action

| What you see | Likely scope | First action |
|---|---|---|
| `DIRECT BASELINE CONNECTED` | US public endpoint is available | Send one command and confirm a matching ACK |
| `CCN ROUTED TEST CONNECTED` | Browser reached the configured Guangzhou WSS ingress | Send one command; confirm a matching ACK before treating it as a successful application sample |
| `CCN ROUTED TEST UNAVAILABLE` | One of public DNS/TLS, Guangzhou ingress, CCN/private origin, WSS, or browser path failed | Start with browser console, Guangzhou Nginx error log, then the Stage 2 private health check |
| Guangzhou `/` returns `404` | Usually expected | The ingress should serve only `/healthz` and `/ws` |
| Guangzhou `/healthz` returns `502` | Upstream private path or TLS/SNI issue | Check CCN routes, private-origin reachability, certificate hostname, and `proxy_ssl_verify` settings |
| `curl -I /healthz` returns `404` | The small health handler may only support `GET` | Use normal `curl -s https://host/healthz`, not `curl -I` |
| A number appears after an unmatched/failed command | Demo defect | Do not use that sample; investigate ACK matching and failure handling |

## Evidence to retain

Keep the following for a reproducible demo record:

- test date and client location/network;
- the two endpoint hostnames and application version, without publishing credentials;
- CCN association/route/bandwidth approval evidence held in the authorized project location;
- Direct and routed success/failure counts;
- raw application RTT samples and stated method; and
- known limitations or public-ingress issues observed during the test.

Do not use this checklist as a contract, SLA, throughput result, or claim of CCN-link latency.
