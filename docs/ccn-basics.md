# CCN basics for first-time Tencent Cloud customers

> **Goal:** understand what CCN is before creating any resource.
>
> This repository demonstrates one specific pattern:
>
> ```text
> China Mainland browser -> Guangzhou public ingress -> CCN -> US private application origin
> ```

## CCN in plain language

A **VPC** is your private network inside a Tencent Cloud region. If you have one VPC in Guangzhou and another in a US region, they are separate private neighborhoods by default.

**Cloud Connect Network (CCN)** is the private network connection layer that lets eligible network instances communicate across those private neighborhoods. In this demo, CCN is the middle segment between a Guangzhou VPC and a US VPC.

A useful analogy:

- The browser needs a **public front door**: the Guangzhou EIP and ingress CVM.
- CCN is the **private highway** between the Guangzhou and US cloud networks.
- The US private origin is the **destination building**.

A browser cannot connect to CCN directly. It reaches the public ingress first; Nginx on that ingress forwards the traffic over the private CCN-connected route.

## What CCN does and does not do

| CCN does | CCN does not do |
|---|---|
| Connect eligible VPCs and other supported network instances through private routing | Replace DNS, TLS certificates, a public EIP, or an application load balancer |
| Let you build multi-region or hybrid private connectivity | Act as a browser plug-in or a one-click website acceleration switch |
| Learn and manage route information through the CCN route table | Make a public browser automatically enter a VPC without a public ingress |
| Support a controlled Guangzhou-to-US private segment after the ingress | Turn a browser Command-to-ACK result into CCN-link latency, one-way latency, or an SLA |

## Is this demo the right starting point?

### Good fit

Use this demo when you want to learn or explain one of these patterns:

1. **China Mainland users accessing an overseas application**: enter through a China Mainland ingress, then forward to the same overseas application origin through a configured private segment.
2. **Multi-region application connectivity**: a service in one Tencent Cloud region needs controlled private access to a service in another region.
3. **A functional customer walkthrough**: show Direct and configured routed paths reaching the same ACK service without claiming a performance guarantee.
4. **A learning lab for CCN fundamentals**: VPC association, CIDRs, routes, bandwidth, private-origin health checks, TLS/WSS, and application validation.

### Not a fit by itself

This repository is not the right answer when you only need:

- a static website on one CVM;
- a China Mainland website for overseas visitors;
- a public CDN cache/edge acceleration design;
- a production security architecture, application authentication system, or multi-tenant proxy; or
- a performance benchmark without a same-client, same-time, comparable measurement plan.

For those cases, start with the appropriate product and solution design rather than forcing CCN into the architecture.

## The minimum resource map

| Layer | Resource | Why it exists | Demo role |
|---|---|---|---|
| US application | US VPC and subnet | Private address space for the application | Holds the ACK origin |
| US application | US CVM, Nginx, Node service | Hosts the static page and ACK service | Direct control endpoint |
| China Mainland ingress | Guangzhou VPC and subnet | Separate private address space | Receives the routed connection |
| China Mainland ingress | Guangzhou CVM + EIP + Nginx | Public front door for routed WSS | Proxies only `/healthz` and `/ws` |
| Private connectivity | CCN instance + VPC associations | Connects the two VPCs | Carries the private middle segment |
| Cross-border enablement | Approved compliance and bandwidth configuration | Enables the applicable region pair under the account workflow | Required before real routed testing |
| Browser trust | Two DNS names and TLS certificates | Separates the two public WSS endpoints | `demo.example.com` and `ccn-path.example.com` |
| Verification | China Mainland test client | Makes the comparison customer-relevant | Uses the same browser and test method for both paths |

## The console workflow at a glance

Do these actions in order. Do not enable the routed browser endpoint early.

```text
1. Build and test the ACK app locally
2. Build the US VPC/CVM and prove the Direct endpoint
3. Build the Guangzhou VPC/CVM/EIP and separate routed DNS/TLS hostname
4. Create CCN and associate both VPCs
5. Review CCN routes and complete applicable cross-border approval/bandwidth steps
6. From Guangzhou, prove private HTTPS reachability to the US origin
7. Configure Guangzhou Nginx as a WSS-only proxy to the US private origin
8. Set ccnPathWs, then test from a China Mainland client
```

The official CCN getting-started flow is likewise centered on creating a CCN instance, associating network instances, checking routes, and configuring bandwidth. See [Tencent Cloud International: Getting Started with CCN](https://intl.cloud.tencent.com/document/product/1003/31985?has_map=1) and [Route Overview](https://intl.cloud.tencent.com/document/product/1003/34259). Availability, compliance requirements, bandwidth options, and commercial terms remain account-, region-, and order-dependent; verify them in the current console and official documentation before purchase.

## The three checks that prevent most beginner mistakes

1. **CIDR check:** Guangzhou and US VPC CIDRs must not overlap. For example, `10.10.0.0/16` and `10.20.0.0/16` are separate; overlapping ranges make routing ambiguous.
2. **Private health check:** Before browser testing, the Guangzhou CVM must reach the US *private* origin using the expected TLS hostname/SNI.
3. **Endpoint check:** `directWs` and `ccnPathWs` are different hostnames. The Direct endpoint uses the US public origin; the routed endpoint uses the Guangzhou public ingress.

## Read next

- **Build it step by step:** [START-HERE.md](START-HERE.md)
- **Validate it safely:** [verification-checklist.md](verification-checklist.md)
- **Understand what the displayed RTT means:** [architecture.md](architecture.md)
- **Deploy Nginx safely:** [deployment-guide.md](deployment-guide.md)
