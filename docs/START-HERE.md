# Start here: your first CCN cross-border workshop

This is the **main workshop guide**. Follow it from top to bottom. You do **not** need to understand the code or start with the local command line.

## 1. Workshop goal

Build and validate this small, controlled application path:

```text
China Mainland browser
  -> Guangzhou public ingress
  -> Guangzhou <-> Silicon Valley CCN private segment
  -> Silicon Valley private application origin
  -> matching ACK returns to the browser
```

You will compare it with a control path:

```text
Browser -> Public Internet -> same Silicon Valley ACK service
```

The goal is to learn **how CCN fits into a real application topology** and to verify that the configured routed application path works. It is not a latency benchmark, price quote, SLA test, or promise that every user will see a performance improvement.

## 2. Who this workshop is for

Use this guide if you are:

- new to Tencent Cloud networking, VPCs, or CCN;
- evaluating a multi-region, multi-VPC, or China Mainland–related application design;
- an application, network, security, or solution team that needs a small PoC before production planning; or
- preparing a customer walkthrough that shows a public ingress and a private cross-region application path.

Do **not** use this as a generic website-acceleration tutorial. CCN is the private connectivity layer between cloud networks; it is not a browser plug-in, CDN, DNS replacement, or a switch a browser can turn on.

### One simple mental model

- **Public front door:** the Guangzhou EIP + CVM lets the browser arrive.
- **Private highway:** CCN connects the Guangzhou and Silicon Valley cloud networks.
- **Destination building:** the Silicon Valley private application origin answers the request.

A browser reaches the public front door first. It does not connect to CCN directly.

## 3. Before you create anything

### Required decisions

Confirm these items with the people who own the application, network, security, and budget:

| You need | Why it matters |
|---|---|
| Tencent Cloud account with permission to create VPCs, CVMs, EIPs, and CCN resources | The workshop creates cloud resources and may incur charges. |
| A US-region application location | This guide uses Silicon Valley as the reference private origin. |
| A Guangzhou ingress location | This guide uses Guangzhou as the China Mainland public entry point. |
| Two non-overlapping VPC address ranges | Private routing cannot be unambiguous when the same IP range exists at both ends. |
| A public DNS name and TLS certificate for each endpoint | Browsers need separate secure Direct and routed WSS endpoints. |
| Approval to run a cross-border PoC | Eligibility, compliance, billing, and available bandwidth are account- and region-dependent. |
| A China Mainland test client for final comparison | A US test client can check setup but cannot represent China Mainland user experience. |

### Read this first: cost and safety

Before creating a CVM or EIP, read [cost-and-safety.md](cost-and-safety.md). It lists possible billable resources, minimum security controls, and stop conditions.

### Tiny glossary

| Term | Meaning in this workshop |
|---|---|
| **VPC** | A private Tencent Cloud network in one region. |
| **CVM** | A virtual machine that runs Nginx or the ACK service. |
| **EIP** | A public IP address used by browsers to reach an ingress. |
| **CCN** | The private network connection between associated VPCs. |
| **Nginx** | The public web gateway that receives HTTPS/WSS and forwards it. |
| **ACK** | A small acknowledgement message showing that the application received a command and replied. |

Need more detail? See [REFERENCE.md](REFERENCE.md) while you are on a specific step. You do not need to read it first.

---

## 4. How to follow this workshop: Console first, Terraform later

**This is a console-first workshop. Do not run Terraform at the beginning.** Build the small topology manually once so you can see which resource performs each role and diagnose a failure without guessing.

The current `infra/terraform/` directory is a **safe reference scaffold**. It contains versions, variables, and example values only; it does not include an executable `main.tf` that creates the topology. Therefore, it is not a workshop step to run `terraform apply`.

| When | Where you work | What you do | Do not do yet |
|---|---|---|---|
| Before any cloud resource | README + Tencent Cloud Console | Choose CIDRs, DNS names, resource owner, expiry date, and budget/compliance owner. | Do not create a CCN, CVM, EIP, or run Terraform. |
| Build the Direct control path | Tencent Cloud Console + US CVM | Create the **US VPC, subnet, CVM, and EIP**. Deploy Nginx and the ACK service. | Do not create the Guangzhou CVM or set `ccnPathWs`. |
| Build the routed entry point | Tencent Cloud Console + Guangzhou CVM | Create the **Guangzhou VPC, subnet, CVM, and EIP**. Set up its DNS and TLS. | Do not treat it as a second website or expose the US private origin directly. |
| Connect the private networks | CCN Console | Create CCN, associate both VPCs, check routes, then complete applicable cross-border approval and bandwidth steps. | Do not enable the routed browser endpoint until private health is successful. |
| Enable the demo | Guangzhou CVM + deployed static site | Configure Nginx proxying and set `ccnPathWs` in the deployment-time config. | Do not commit live endpoints or credentials. |
| After a successful manual workshop | Terraform, if you decide to automate a future lab | Use Terraform only for repeatable non-production foundation resources after reviewing the current provider/docs. | Do not expect Terraform to obtain cross-border compliance, purchase bandwidth, configure production DNS/certificates, or replace security review. |

### The exact order to remember

```text
Plan -> US CVM -> Direct test -> Guangzhou CVM -> CCN and approval -> Private health check -> Routed endpoint -> China Mainland test -> Cleanup
```

If you are following this for the first time, stay in the Tencent Cloud Console until **Step 7** is complete. Terraform is an optional follow-up for a later, repeatable lab; it is not needed to finish this Workshop.

---

## 5. Workshop steps

Complete the steps in this order. Do not enable the routed browser endpoint before Step 6.

### Step 1 — Choose your safe lab design

**Do**

1. Pick two non-overlapping VPC CIDRs. Example: Guangzhou `10.10.0.0/16`; Silicon Valley `10.20.0.0/16`.
2. Decide two DNS names:
   - Direct endpoint: `demo.example.com`
   - Routed endpoint: `ccn-path.example.com`
3. Assign an owner and expiry date to each workshop resource.
4. Decide whether you will use a real China Mainland client for the final test.

**Expected result**

You have a written topology, two distinct hostnames, non-overlapping CIDRs, and an agreed cleanup owner.

**If you are blocked**

- Do not reuse VPC ranges without checking for overlap.
- Do not use a production VPC or a shared production security group for a first workshop.
- Do not continue until budget and cross-border approval ownership are clear.

---

### Step 2 — Run the application locally (optional but recommended)

This step checks the sample application before cloud resources are created. Skip it only if a technical owner has already validated the repository.

**Do**

```bash
npm run smoke

HOST=127.0.0.1 \
PORT=8787 \
ALLOWED_ORIGINS=http://127.0.0.1:8080 \
npm start
```

In a second terminal:

```bash
python3 -m http.server 8080 -d app
```

Open:

```text
http://127.0.0.1:8080?ws=ws://127.0.0.1:8787/ws
```

**Expected result**

- Tests pass.
- The Direct path connects and a command produces one matching ACK.
- The routed path remains unavailable because you have not built it yet.

**If you are blocked**

Check that Node.js 22+ and Python 3 are installed, and that the first terminal still has the Node service running. The local query parameter works only for Direct debugging; it cannot activate the routed path.

---

### Step 3 — Build and test the US Direct endpoint

**Do**

1. Create a US VPC and CVM.
2. Run the included Node ACK service on `127.0.0.1:8787`.
3. Install Nginx and publish only the browser files from `app/` in a dedicated web root.
4. Add an EIP, the Direct DNS name, and TLS certificate.
5. Set only `directWs` in the deployment-time `app/demo-config.js`:

```js
window.CCN_DEMO_CONFIG = Object.freeze({
  directWs: "wss://demo.example.com/ws",
  ccnPathWs: "",
  defaultMode: "direct",
});
```

6. From the browser, send ten sequential Direct commands.

**Expected result**

- `https://demo.example.com` loads.
- The UI shows `DIRECT BASELINE CONNECTED`.
- Ten commands produce ten matching ACKs.

**If you are blocked**

Check the Node health endpoint, Nginx configuration, DNS/TLS, firewall/security-group rules, and `ALLOWED_ORIGINS`. Do not call the displayed ACK number a CCN result; this is the public-Internet control path.

---

### Step 4 — Build the Guangzhou public ingress

**Do**

1. Create the Guangzhou VPC, subnet, CVM, and EIP using the CIDR you selected.
2. Allow only required public HTTPS/WSS traffic and restricted administration access.
3. Point `ccn-path.example.com` at the Guangzhou EIP and provision a TLS certificate.
4. Configure the ingress so it will expose only `/healthz` and `/ws` after the private route is ready.

**Expected result**

The Guangzhou CVM is ready to be the **public front door** for the routed path. It does not need to host the browser page.

**If you are blocked**

A `404` at `https://ccn-path.example.com/` is expected in this design. The host is a narrow proxy, not a second copy of the website.

---

### Step 5 — Create CCN and prove the private path

**Do**

1. Create a CCN instance.
2. Associate the Guangzhou and US VPCs.
3. Check the CCN route table and VPC routes. Each VPC must have a valid route to the other VPC's CIDR, with no overlap or conflict.
4. Complete the applicable cross-border compliance and bandwidth workflow in the Tencent Cloud console.
5. From the Guangzhou CVM, verify HTTPS reachability to the **US private IP** of the origin while preserving the TLS hostname:

```bash
curl --resolve demo.example.com:443:US_PRIVATE_IP \
  https://demo.example.com/healthz
```

**Expected result**

The private health check returns the expected JSON response from the US ACK origin.

**If you are blocked**

Stop browser testing and check, in order: VPC CIDRs, CCN association, selected routes, security groups, US service listener, and TLS/SNI configuration.

**Important**

Tencent Cloud's documented CCN sequence is **create CCN -> associate network instances -> check route table -> configure bandwidth**. [Official CCN guide](https://www.tencentcloud.com/document/product/1003/31985). Cross-border eligibility, approval, billing, bandwidth, and available region pairs must be checked in the current console and commercial process; this repository cannot grant them.

---

### Step 6 — Configure the routed WebSocket proxy

**Do**

1. Configure Nginx on Guangzhou to forward `/healthz` and `/ws` to the US private origin.
2. Retain upstream TLS certificate and hostname verification.
3. Verify the Guangzhou public health endpoint.
4. Only now set `ccnPathWs` in the deployment-time configuration:

```js
window.CCN_DEMO_CONFIG = Object.freeze({
  directWs: "wss://demo.example.com/ws",
  ccnPathWs: "wss://ccn-path.example.com/ws",
  defaultMode: "direct",
});
```

**Expected result**

- `https://ccn-path.example.com/healthz` returns the expected health response.
- The UI shows `CCN ROUTED TEST CONNECTED` when the routed mode is selected.
- A routed command produces `REAL ROUTED ACK RTT` only after a matching ACK returns.

**If you are blocked**

- `502` generally points to the private path or upstream TLS/SNI configuration.
- A browser WSS error after a successful private health check generally points to public DNS/TLS, Nginx Upgrade headers, security group, or the public ingress path.
- Never disable `proxy_ssl_verify` only to hide a certificate problem.

---

### Step 7 — Run the customer-relevant test and record the outcome

**Do**

1. Use the same China Mainland client/network, browser version, command payload/count, US backend version, and time window for both paths.
2. Run Direct first, then routed.
3. Keep both success and failure counts.
4. Record the client location/network, endpoint condition, time, command count, and raw application ACK results.

**Expected result**

You have a reproducible functional test record that shows whether each endpoint completed matching application ACKs.

**How to explain the result**

> “This proves that the configured application path returned matching ACKs. It is not a standalone claim about CCN-link latency, SLA, bandwidth, or a guaranteed user-experience improvement.”

---

### Step 8 — Close the workshop safely

**Do**

1. Decide whether to retain the lab for an approved next test.
2. If not, blank `ccnPathWs` in the deployed configuration first.
3. Remove public exposure, then release EIPs, CVMs, disks/snapshots, CCN bandwidth configuration, associations, and VPCs after checking dependencies.
4. Review the billing/resource console.

**Expected result**

The customer-facing page no longer points to deleted infrastructure and no unintended workshop resources remain.

Follow the full [cleanup procedure](cleanup.md). Do not assume deleting a CVM automatically releases every related billable resource.

---

## 5. Common questions

### “Why does the workshop have Direct and routed paths?”

Direct is the control path over the public Internet. Routed enters through Guangzhou, then uses the CCN-connected private segment. Both reach the same ACK service so the application target stays the same.

### “Can the browser connect to CCN directly?”

No. The browser connects to a public HTTPS/WSS hostname. The Guangzhou ingress then sends traffic over the private CCN-connected path.

### “Does a lower ACK number prove CCN is faster?”

No. The number is application-level Command-to-ACK RTT. A valid comparison needs matched client, network, browser, payload, backend, and time conditions. It is never by itself an SLA or performance guarantee.

### “Why is the Guangzhou root URL returning 404?”

That is intentional. Guangzhou is a narrow ingress proxy for `/healthz` and `/ws`, not a public website host.

### “Can Terraform make this one-click?”

Not safely for the entire cross-border process. Terraform can describe some foundation resources, but it does not replace account-specific compliance, bandwidth, commercial approval, DNS, TLS, security review, or production ownership. See [`../infra/terraform/README.md`](../infra/terraform/README.md).

## 6. When you need more detail

- Technical architecture, Nginx, exact verification checks, fair-test rules, and developer protocol: [REFERENCE.md](REFERENCE.md)
- Cost, security, and stop conditions: [cost-and-safety.md](cost-and-safety.md)
- Cleanup: [cleanup.md](cleanup.md)
- Public GitHub maintainer release checklist: [release-checklist.md](release-checklist.md)
