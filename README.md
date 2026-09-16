# CCN Cross-Border Command-to-ACK Demo

A public reference demo for showing the architecture and functional behavior of two browser-to-service paths:

```text
Direct baseline
Browser -> Public Internet -> US ACK origin

Configured routed path
Browser -> China Mainland ingress -> CCN Cross-Border Bandwidth -> US private origin -> Same ACK service
```

The UI is designed for customer walkthroughs. It separates a Direct control path from a separately configured routed path and records a result only after the browser receives a matching acknowledgement for the same command ID.

> **Measurement boundary:** the displayed value is a Command-to-ACK round-trip application acknowledgement (RTT). It is not one-way latency, network RTT, CCN-link latency, throughput, jitter, packet loss, SLA evidence, or a performance guarantee.

## New to CCN? Start here first

This repository is designed as a **new-customer CCN learning demo**, not just an application sample. Read the material in this order:

| Read this | You will learn | Use it when |
|---|---|---|
| **[CCN basics in plain language](docs/ccn-basics.md)** | What CCN does, when it fits, the resources involved, and the console flow | You are new to VPC, CCN, private routing, or cross-border architecture |
| **[Visual field guide](docs/START-HERE.html)** | The architecture and eight-step journey at a glance | You want the quick visual explanation before touching the console |
| **[Step-by-step build guide](docs/START-HERE.md)** | Prerequisites, resource preparation, configuration steps, expected results, and first troubleshooting actions | You are ready to configure the demo |
| **[Verification checklist](docs/verification-checklist.md)** | Exactly what to validate before enabling `ccnPathWs` or presenting results | You have created cloud resources and need a go/no-go checklist |
| **[Cost and safety guardrails](docs/cost-and-safety.md)** | Billable-resource, security, measurement, and stop-condition boundaries | Before provisioning any cloud resource |
| **[Cleanup procedure](docs/cleanup.md)** | How to disable the workshop endpoint and release Workshop resources | Before ending the lab or handing it off |
| **[Public release checklist](docs/release-checklist.md)** | What to verify before publishing or updating the public GitHub repository | Immediately before every public push |

### The one-sentence model

**CCN is the private connectivity layer between your cloud networks; a browser first enters a public Guangzhou ingress, which then proxies traffic over the CCN-connected private segment to the US application origin.**

## Learning objectives

After completing this Workshop, you should be able to:

1. Explain the separate roles of browser, EIP, CVM, VPC, subnet, CCN, route table, and private origin.
2. Create a Direct control path and a separately configured routed path that reach the same ACK service.
3. Plan non-overlapping VPC CIDRs and validate private reachability before enabling public routed WSS.
4. Recognize that a matching ACK is an application-continuity result, not a CCN performance or SLA claim.
5. Apply minimum-exposure controls and clean up billable Workshop resources deliberately.

The demo uses two routes that reach the same US ACK service:

```text
A. Direct: Browser -> Public Internet -> US ACK service
B. Routed: Browser -> Guangzhou public ingress -> CCN -> US private origin -> same ACK service
```

Start with the Direct path, then add the China Mainland ingress, CCN association/routes, applicable cross-border approval and bandwidth configuration, private-origin health check, and finally the routed WSS endpoint. Do not enable `ccnPathWs` before those checks pass.

## What is included

- Static customer-facing browser demo in `app/`.
- Bounded, Node 22 built-in-only WebSocket ACK service in `server/`.
- Protocol, architecture, deployment, security, and test documentation in `docs/`.
- Sanitized Nginx examples for a US public demo origin and a China Mainland ingress proxy.
- A Terraform **reference scaffold** with safe variables and an example `.tfvars` file.
- GitHub Actions checks for syntax, protocol behavior, and public configuration boundaries.

## What is intentionally not included

- Production domains, public/private IP addresses, CVM/VPC/EIP IDs, account IDs, certificates, SSH keys, or Terraform state.
- A claim that this repository creates or validates a CCN cross-border connection.
- A one-click Terraform implementation for cross-border CCN compliance or bandwidth purchase.
- Any customer performance claim.

## Local quick start

Requirements: Node.js 22+ and Python 3. No npm packages are required.

```bash
npm run smoke

HOST=127.0.0.1 \
PORT=8787 \
ALLOWED_ORIGINS=http://127.0.0.1:8080 \
npm start
```

In another terminal:

```bash
python3 -m http.server 8080 -d app
```

Open `http://127.0.0.1:8080`.

For a local Direct ACK test, append a query parameter to the page URL:

```text
?ws=ws://127.0.0.1:8787/ws
```

The query parameter is supported only for the Direct local-debug path. It cannot activate the routed path.

## Configure real endpoints safely

1. Leave the repository's `app/demo-config.js` with blank endpoint values.
2. Copy `app/demo-config.example.js` during deployment and replace only the two example WSS hostnames.
3. Use a reviewed Direct endpoint for `directWs`.
4. Enable `ccnPathWs` only after verifying the separate China Mainland ingress, CCN route, US private-origin reachability, TLS/WSS, compliance status, and rollback path.
5. Never place credentials or tokens in browser configuration or WebSocket URLs.

See [`docs/architecture.md`](docs/architecture.md) for evidence boundaries and [`docs/test-methodology.md`](docs/test-methodology.md) for fair comparison conditions.

## Workshop lifecycle

```text
1. Read cost and safety guardrails.
2. Run the local Direct-only demo.
3. Build and verify the US Direct origin.
4. Build Guangzhou ingress and complete the approved CCN prerequisites.
5. Verify the private path before enabling routed WSS.
6. Validate Direct and routed ACK behavior from a suitable test client.
7. Follow the cleanup procedure and review billing resources.
```

Read [cleanup.md](docs/cleanup.md) **before** provisioning cloud resources. The cleanup guide identifies resources that may continue to incur charges after a CVM is terminated.

## Reference infrastructure

- [`infra/nginx/us-demo.conf.example`](infra/nginx/us-demo.conf.example) hosts the static demo and proxies the local Node service.
- [`infra/nginx/guangzhou-ingress.conf.example`](infra/nginx/guangzhou-ingress.conf.example) accepts only `/healthz` and `/ws`, then proxies to a US private origin with TLS/SNI verification enabled.
- [`infra/terraform/`](infra/terraform/) is a safe starting scaffold, not a representation of a deployed account.

Before testing a real CCN routed path, complete the applicable Tencent Cloud cross-border compliance and commercial process. Verify real topology and route health independently; server ACK metadata alone does not prove browser ingress or CCN routing.

## Validate before publishing changes

```bash
npm run smoke
```

Also scan staged changes for secrets and real deployment references. Never commit:

```text
*.pem, *.key, .env, terraform.tfstate*, cloud resource IDs, real IP addresses, production domains, or live endpoint configuration
```

See [`SECURITY.md`](SECURITY.md) for deployment constraints and responsible disclosure guidance.

## License

[MIT](LICENSE)
