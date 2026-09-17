# Cost and safety guardrails

This repository is a learning and functional-validation Workshop. It can create billable cloud resources and public endpoints when deployed.

## Cost boundary

Do not treat this repository as a free-tier guarantee, a price quote, or a commitment that every account can provision the same topology.

Potential billable items include:

```text
CVM instances
public EIPs and public-network traffic
cloud disks, snapshots, and custom images
DNS and certificates, depending on the chosen service
CCN and applicable cross-border bandwidth
NAT gateways, load balancers, or monitoring services if added
```

Pricing, availability, billing method, cross-border eligibility, approval timing, and bandwidth limits vary by account, region, line type, product version, and commercial agreement. Before creating resources:

1. Review current console pricing for your target regions.
2. Obtain budget-owner approval.
3. Set an owner and expiry date for every Workshop resource.
4. Read [cleanup.md](cleanup.md) before provisioning anything.

## Security boundary

This Workshop should use a minimum-exposure topology:

```text
Public browser -> HTTPS/WSS only -> Guangzhou ingress
Guangzhou ingress -> CCN private route -> Silicon Valley CVM private VPC address
Node ACK service -> loopback only
```

Minimum controls:

- Do not expose the Node service port directly to the public Internet.
- Restrict SSH administration to approved source IPs or a managed access method; never use `0.0.0.0/0` as the Workshop default.
- Expose the Guangzhou ingress only on required HTTPS/WSS ports.
- Serve browser files from a dedicated static document root, not from the project directory.
- Keep `/healthz` minimal and non-sensitive.
- Expose only intended Guangzhou ingress paths such as `/healthz` and `/ws`.
- Retain upstream TLS certificate and hostname verification; do not use `proxy_ssl_verify off` as a workaround.
- Use separate Direct and routed hostnames.
- Generate live endpoint values only in ignored `runtime-config.js` in the deployed static web root, outside the source checkout; never place them in a tracked source file.

## What must never be committed

```text
private keys, certificates, access tokens, SecretId, SecretKey
production domains, live WSS endpoints, EIPs, private IPs
account IDs, sub-account IDs, CVM/VPC/subnet/CCN/EIP identifiers
Terraform state, plans, backends, local tfvars, or cloud credentials
packet captures, production logs, customer test data, support tickets
approval records, pricing, discounts, contracts, or customer screenshots
```

Use the repository's `.gitignore`, then run a staged-change secret scan before every push.

## Measurement boundary

A successful matched WebSocket ACK proves application continuity for the configured route. A displayed Command-to-ACK application RTT is **not**:

```text
CCN-link latency
one-way latency
throughput, jitter, packet loss, or an SLA
customer-wide China Mainland user experience
proof of cross-border approval or commercial entitlement
```

For a customer-relevant Direct-versus-routed comparison, use the same China Mainland test client, browser, payload, origin, and test window. Preserve both successes and failures.

## Stop conditions

Stop the Workshop and seek the appropriate owner or support channel if:

- cross-border eligibility or approval is unclear;
- current pricing or billing ownership is not confirmed;
- public TLS/WSS is unstable or an unknown reset occurs;
- a resource is shared with production;
- any real credential, resource identifier, or customer data is found in the public candidate repository.
