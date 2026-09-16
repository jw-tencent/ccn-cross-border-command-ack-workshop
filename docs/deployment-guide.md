# Deployment guide

This guide describes a safe reference deployment. It does not replace cloud-account review, cross-border compliance, DNS ownership, security review, observability, or incident procedures.

**New to CCN?** Read [ccn-basics.md](ccn-basics.md) first, then follow [START-HERE.md](START-HERE.md) for the build order. Use [verification-checklist.md](verification-checklist.md) as the go/no-go gate before enabling the routed endpoint.

## 1. US application origin

1. Provision a US CVM in a VPC.
2. Keep the Node service on `127.0.0.1:8787` with exact `ALLOWED_ORIGINS`.
3. Publish only the browser assets under `app/` to a dedicated document root such as `/var/www/ccn-demo-public`.
4. Use `infra/nginx/us-demo.conf.example` as the starting point for HTTPS/WSS.
5. Add a deployer-controlled domain and TLS certificate.
6. Verify `GET /healthz` locally and through the public Direct hostname.

## 2. China Mainland routed ingress

1. Provision a China Mainland ingress CVM and public EIP under the required approval model.
2. Create non-overlapping China Mainland and US VPC CIDRs.
3. Complete CCN VPC association, routes, cross-border compliance, and bandwidth configuration through the approved account process.
4. From the ingress CVM, validate private reachability to the US origin before opening the public endpoint.
5. Use `infra/nginx/guangzhou-ingress.conf.example` as a starting point. It should expose `/healthz` and `/ws` only.
6. Retain upstream TLS certificate and hostname verification. Do not use `proxy_ssl_verify off` merely to resolve a certificate-chain issue.
7. Configure the public routed WSS hostname in the deployment-time copy of `app/demo-config.js` only after all health checks pass.

## 3. Go-live checks

- `npm run smoke` passes.
- Direct and routed WebSocket endpoints are distinct and each reaches the same US ACK service.
- Browser connection status reflects actual connection success; a failure must not yield an RTT sample.
- Static web root exposes no source, runbooks, server code, or system configuration.
- No private key, credential, resource ID, or Terraform state is in the Git repository.
- Validation includes a China Mainland client for a customer-relevant comparison.

## 4. Rollback

Remove or blank `ccnPathWs` from the generated deployment configuration, reload the static site, and retain the Direct baseline. This changes UI configuration only; it does not replace network rollback or security procedures.
