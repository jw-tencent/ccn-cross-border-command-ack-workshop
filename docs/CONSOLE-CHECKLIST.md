# Console build checklist: first CCN cross-border workshop

Use this checklist with [START-HERE.md](START-HERE.md). It tells a beginner **what must be true before moving forward**. It does not replace the current Tencent Cloud Console workflow, account-specific eligibility checks, or technical-owner implementation detail.

> **Ownership rule:** A customer or project owner can track this checklist. A technical owner must perform deployment actions. A network/security owner must approve private-network and exposure decisions. An account/compliance owner must confirm cross-border eligibility, approval, bandwidth, and budget conditions.

## 1. Lab readiness — before creating any resource

| Console area or owner | Create or confirm | Minimum safe input | Ready when | Stop if |
|---|---|---|---|---|
| Project owner | Lab scope | China Mainland user location, US application location, resource owner, expiry date | The team agrees this is a non-production functional-validation lab | The purpose, owner, or cleanup date is unclear |
| Account/budget owner | Account access and budget | Permission to create VPC, CVM, EIP, and CCN resources; approved budget | The responsible account and budget owner are named | Pricing, billing, or account ownership is unclear |
| Network/security owner | Private address plan | Two non-overlapping CIDRs, for example Guangzhou `10.10.0.0/16` and Silicon Valley `10.20.0.0/16` | No overlap or route conflict is expected | A range overlaps an existing or shared network |
| Technical owner | DNS and certificate plan | Separate Direct and routed hostnames; TLS certificate owner | Two endpoint names and their owners are known | The team cannot safely manage DNS or TLS |
| Account/compliance owner | Cross-border gate | For Guangzhou–Silicon Valley, confirm **postpaid-by-bandwidth** CCN eligibility, the applicable approval, China Unicom agreement/commercial workflow, and capacity | The team knows the required process before enabling the cross-border path | Eligibility, billing mode, approval, or capacity is unknown |

**Go:** Move to the Direct build only after every row has a named owner. Current prepaid cross-border bandwidth supports Chinese mainland–Hong Kong, China only; do not use prepaid CCN as a substitute for this Guangzhou–Silicon Valley lab. See [Configuring Bandwidth](https://www.tencentcloud.com/document/product/1003/38894).

## 2. US Direct endpoint — build the control path first

| Console area | Technical-owner action | Expected state | Go / no-go |
|---|---|---|---|
| VPC and subnet | Create a non-production Silicon Valley (US) VPC and subnet | CIDR is unique and documented | **Go** only if it does not overlap with the planned Guangzhou VPC |
| CVM | Create the US origin CVM | The CVM has the required private connectivity and administrative access is restricted | **No-go** if the CVM or security group is shared with production |
| EIP and DNS | Bind an EIP and map the Direct DNS hostname | The Direct hostname resolves to the US public endpoint | **Go** only after DNS ownership and TLS responsibility are clear |
| Security group | Permit only required HTTPS/WSS and restricted administration access | Node ACK port is not publicly exposed | **No-go** if administrative access is open to `0.0.0.0/0` by default |
| Application deployment | Run the ACK service on loopback with `ALLOWED_ORIGINS=https://DIRECT_HOST`; publish browser files plus ignored `runtime-config.js` through US Nginx | `https://DIRECT_HOST` loads and `/healthz` returns expected health JSON | **Go** only after one browser command returns a matching Direct ACK |

**Evidence to save:** Direct hostname, timestamp, one health-check result, and Direct success/failure count. Do not place live endpoints, IPs, credentials, or screenshots containing account identifiers into the public repository.

## 3. Guangzhou public ingress — prepare the browser front door

| Console area | Technical-owner action | Expected state | Go / no-go |
|---|---|---|---|
| VPC and subnet | Create the Guangzhou VPC and subnet with the planned CIDR | CIDR does not overlap with the US VPC | **No-go** if a route could be ambiguous |
| CVM and EIP | Create an ingress CVM and bind an EIP | The host is dedicated to the workshop ingress | **Go** only if it is not a second public website or production host |
| Security group | Allow only the required public HTTPS/WSS traffic and restricted administration access | Public exposure is limited to the intended ports | **No-go** if the ACK service port or unnecessary paths are public |
| DNS and TLS | Point the routed hostname to the Guangzhou EIP and provision TLS | The routed hostname is ready for public HTTPS/WSS | **Note:** a `404` at `/` is expected; this host will serve only `/healthz` and `/ws` |

**Evidence to save:** Routed hostname owner, ingress CVM owner, and confirmation that only intended public ports/paths will be exposed.

## 4. CCN and private-path gate — prove connectivity before browser testing

| Console area | Network/security or account-owner action | Expected state | Go / no-go |
|---|---|---|---|
| CCN Console | Create CCN and associate the Guangzhou and US VPCs | Both intended VPCs appear as associated network instances | **No-go** if the wrong VPC, a shared production VPC, or overlapping CIDRs are involved |
| CCN and VPC route tables | Check that each VPC can reach the other VPC CIDR without conflict | Routes are valid and unambiguous | **No-go** if a required route is missing or conflicts |
| Cross-border workflow | Complete the account-confirmed postpaid-by-bandwidth approval, China Unicom agreement/commercial, and capacity process | The account/compliance owner confirms the current workflow is complete enough for this PoC | **No-go** if billing mode, approval, eligibility, or bandwidth status remains unknown |
| Guangzhou CVM | Test the US CVM private VPC address while retaining the Direct TLS hostname | The private-VPC `/healthz` check returns expected JSON from the same ACK service | **No-go** if the private-VPC health check fails; do not enable routed WSS yet |

**Technical-owner command template:**

```bash
curl --resolve DIRECT_HOST:443:US_PRIVATE_IP \
  https://DIRECT_HOST/healthz
```

Replace `DIRECT_HOST` and `US_PRIVATE_IP` only in your private deployment environment. Do not commit them.

## 5. Routed endpoint — enable only after the private-VPC check passes

| Console area | Technical-owner action | Expected state | Go / no-go |
|---|---|---|---|
| Guangzhou Nginx | Forward only `/healthz` and `/ws` to the US CVM private VPC address; retain upstream TLS hostname and certificate verification | `https://ROUTED_HOST/healthz` returns expected JSON | **No-go** if Nginx returns `502` or upstream TLS validation fails |
| Deployed browser configuration | In the US Direct host's static web root, add the reviewed routed WSS hostname as `ccnPathWs` to ignored `runtime-config.js` | Browser page on `https://DIRECT_HOST` displays `CCN ROUTED TEST CONNECTED` | **No-go** if the endpoint is malformed, unreachable, or has not passed private-VPC health |
| Browser test | Send one routed command | One matching ACK produces `REAL ROUTED ACK RTT` | **No-go** if a failed/unmatched command creates a successful sample |

**Expected behavior:** `https://ROUTED_HOST/` may return `404`. The Guangzhou ingress is intentionally a narrow proxy, not a second website.

## 6. Customer-relevant validation and cleanup

1. Use the same China Mainland client/network, browser version, command count/payload, US backend version, and time window for both Direct and routed tests.
2. Run Direct first, then routed. Keep both success and failure counts.
3. Record the result in [TEST-RECORD-TEMPLATE.md](TEST-RECORD-TEMPLATE.md).
4. Treat matching ACKs as functional application-path evidence only. They are not proof of CCN-link latency, throughput, jitter, packet loss, SLA, or guaranteed user-experience improvement.
5. Follow [cleanup.md](cleanup.md) after the lab. Disable the routed endpoint in deployed browser configuration before removing the Guangzhou ingress.
