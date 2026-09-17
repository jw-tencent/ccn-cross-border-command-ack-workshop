# Technical reference: architecture, deployment, and validation

> **Technical owner only:** this document contains commands and Nginx configuration examples. If you are new to Tencent Cloud, stay in [START-HERE.md](START-HERE.md) and ask a technical owner to use this reference when a specific workshop step requires it.

It combines architecture, deployment, verification, and fair-test notes so the beginner workshop can stay focused on the build sequence.

## 1. The two paths and the evidence boundary

```text
Direct control path
Browser -> Public Internet -> US ACK service

Configured routed path
Browser -> Guangzhou public ingress -> CCN -> Silicon Valley CVM private VPC address -> same ACK service
```

The Direct path is the control and reaches the US CVM's public Nginx endpoint. The routed path checks whether the configured Guangzhou-to-Silicon-Valley private VPC leg works. Both paths end at the **same** loopback-only ACK service so that you are not comparing different application versions. This lab does not demonstrate a strictly private-only US web origin.

A result appears only when the browser receives an ACK with the same `eventId` as its command:

```text
browser sends command -> matching ACK returns -> browser records Command-to-ACK RTT
```

This proves an application exchange completed through the configured endpoint. It does **not** prove:

- one-way latency, network RTT, or CCN-link latency;
- throughput, jitter, or packet loss;
- an SLA, price, entitlement, or performance guarantee; or
- user experience for every ISP, device, or location.

For a customer-relevant comparison, use the same China Mainland client and network, browser version, command payload/count, US backend version, and time window. Keep failures in the record. A client outside China Mainland is useful for setup checks but does not represent China Mainland user experience.

## 2. Plain-language glossary

| Term | Simple meaning in this workshop |
|---|---|
| **VPC** | Your private cloud network in one region. Guangzhou and Silicon Valley are two separate private networks. |
| **CIDR** | The IP-address range of a VPC, such as `10.10.0.0/16`. The two VPC ranges must not overlap. |
| **CVM** | A virtual machine running your software. |
| **EIP** | A public IP address that lets a browser reach the Guangzhou ingress or US Direct endpoint. |
| **Ingress** | The public front door. Here it is a Guangzhou CVM with an EIP and Nginx. |
| **CCN** | The private connectivity layer between associated cloud networks. It is not a browser setting. |
| **Route table** | The network map that decides where a private IP range is reached. |
| **US VPC endpoint** | The Silicon Valley CVM's private IP, reached from Guangzhou over CCN. |
| **Nginx** | The web gateway: it terminates HTTPS/WSS and forwards browser requests to the local service or US VPC endpoint. |
| **WSS** | Secure WebSocket. The browser uses it to send a command and wait for a matching ACK. |

## 3. Minimum topology and security controls

```text
Public browser
  -> HTTPS/WSS only
  -> Guangzhou EIP + Nginx ingress
  -> CCN private route
  -> Silicon Valley CVM private VPC address
  -> Node ACK service on loopback
```

Use these controls from the beginning:

- Give the Guangzhou ingress and US Direct service different DNS hostnames.
- Expose the Node ACK service only on `127.0.0.1:8787`; do not publish its port directly.
- Publish browser files from a dedicated Nginx document root, never from the project directory.
- On Guangzhou, expose `/healthz` and `/ws` only; a `404` response on `/` is intentional.
- Restrict administrative access. Do not use `0.0.0.0/0` SSH rules as a workshop default.
- Keep upstream TLS verification enabled in Guangzhou Nginx. Do not use `proxy_ssl_verify off` to bypass a certificate issue.
- Leave repository endpoint values blank. Put live hostnames only in a deployment-time configuration file that is not committed.

For cost, public-exposure, and stop conditions, read [cost-and-safety.md](cost-and-safety.md) before provisioning resources.

## 4. Console and deployment detail

### US Direct origin

1. Create a US VPC and CVM.
2. Run the included Node ACK service on `127.0.0.1:8787` with the exact browser origin hosted on the Direct host:

   ```bash
   HOST=127.0.0.1 PORT=8787 ALLOWED_ORIGINS=https://DIRECT_HOST npm start
   ```

   Use a comma-separated additional origin only when it also serves the browser page. Wildcards are rejected.
3. Publish only browser assets plus an ignored, deployment-generated `runtime-config.js` in a dedicated Nginx web root outside the source checkout.
4. Add an EIP, your Direct DNS hostname, and TLS. The Direct path reaches this public Nginx endpoint; the Node ACK service itself remains loopback-only.
5. Use [`../infra/nginx/us-demo.conf.example`](../infra/nginx/us-demo.conf.example) as the starting point.

Expected checks:

```text
GET http://127.0.0.1:8787/healthz -> health JSON
GET https://DIRECT_HOST/healthz -> health JSON
wss://DIRECT_HOST/ws -> Direct connection and matching ACK
```

### Guangzhou routed ingress

1. Create a Guangzhou VPC, subnet, CVM, and EIP. Ensure its CIDR does not overlap with the US VPC.
2. Assign a separate routed DNS hostname and TLS certificate to the Guangzhou EIP.
3. Create a CCN instance and associate both VPCs.
4. Inspect CCN routes and VPC routes. The route toward the other VPC must be valid and unambiguous.
5. Complete the account-confirmed cross-border approval and bandwidth process. For this Guangzhou–Silicon Valley lab, current postpaid cross-border capability requires **postpaid by bandwidth**; prepaid cross-border bandwidth currently supports Chinese mainland–Hong Kong, China only.
6. From Guangzhou, test the US CVM private VPC address before exposing the routed WSS endpoint.
7. Configure Nginx with [`../infra/nginx/guangzhou-ingress.conf.example`](../infra/nginx/guangzhou-ingress.conf.example).

US VPC endpoint health test template:

```bash
curl --resolve DIRECT_HOST:443:US_PRIVATE_IP \
  https://DIRECT_HOST/healthz
```

Replace `DIRECT_HOST` and `US_PRIVATE_IP` with your own deployment values. A successful result should be the expected health JSON from the same ACK service used by the Direct path. If it fails, fix CIDRs, CCN association, route tables, security groups, upstream service, or TLS/SNI before continuing.

**VERIFIED — Tencent Cloud's standard CCN flow is: create a CCN instance, associate network instances, check route tables, then configure bandwidth.** See [Getting Started with CCN](https://www.tencentcloud.com/document/product/1003/31985). Cross-border eligibility, approval, region pairs, billing, and available bandwidth are account- and product-condition dependent. For this lab, current postpaid cross-border capability requires **postpaid by bandwidth**; prepaid cross-border bandwidth currently supports Chinese mainland–Hong Kong, China only. Review [Configuring Bandwidth](https://www.tencentcloud.com/document/product/1003/38894) and the current console before ordering.

## 5. Endpoint configuration and verification gate

Only after the preceding checks pass, generate `runtime-config.js` in the deployed **US Direct-host static web root**. This file is intentionally ignored by Git and must remain outside the source checkout:

```js
window.CCN_DEMO_CONFIG = Object.freeze({
  directWs: "wss://demo.example.com/ws",
  ccnPathWs: "wss://ccn-path.example.com/ws",
  defaultMode: "direct",
});
```

Required results:

| Check | Expected result |
|---|---|
| Direct endpoint connects | `DIRECT BASELINE CONNECTED` |
| One Direct command | One matching Direct ACK sample |
| Routed endpoint connects | `CCN ROUTED TEST CONNECTED` |
| One routed command | One `REAL ROUTED ACK RTT` after a matching ACK |
| Routed endpoint is unavailable or malformed | Unavailable/pending state and **no** successful routed RTT |
| Guangzhou root `/` returns `404` | Normally expected; the ingress is not a second website |

Neither endpoint can be activated by a URL query parameter. Never put credentials, access tokens, private IPs, or production-only hostnames into the public repository or tracked source files.

## 6. Fast troubleshooting

| Symptom | First place to investigate |
|---|---|
| Direct endpoint unavailable | US Node health, US Nginx, Direct DNS/TLS, `ALLOWED_ORIGINS` |
| Routed endpoint unavailable | Routed DNS/TLS, Guangzhou EIP/security group, Guangzhou Nginx error log |
| Guangzhou `/healthz` returns `502` | US VPC endpoint health check, CCN routes, upstream TLS hostname/SNI verification |
| US VPC health works but browser WSS fails | Nginx Upgrade headers, public certificate/SNI, browser console, public ingress path |
| `curl -I /healthz` returns `404` | The sample health handler may support `GET` only; use `curl -s https://HOST/healthz` |
| A result appears after an unmatched/failed command | Treat it as a demo defect; do not use the sample |

## 7. Developer-only protocol details

The browser sends a JSON WebSocket `game_command` containing `eventId`, `command`, `clientSentMonoMs`, and `schemaVersion: 1`. The service returns an `ack` with the same `eventId`.

- Browser transport is WebSocket at `/ws`; public deployments should use `wss://`.
- Text JSON frames are bounded by `MAX_PAYLOAD_BYTES` (maximum 64 KiB).
- The browser `Origin` must match an `ALLOWED_ORIGINS` value; wildcards are rejected.
- The service's returned `routeId` / `routeStatus` identifies the ACK service only. It is not proof of browser ingress or CCN routing.
- Malformed, unmasked, fragmented, binary, unsupported, and oversized client frames are rejected.

For implementation-level field definitions and examples, see [`../server/server.js`](../server/server.js) and its tests. Most workshop participants do not need to read protocol internals.
