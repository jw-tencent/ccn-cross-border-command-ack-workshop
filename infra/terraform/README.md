# Terraform reference scaffold

This directory deliberately provides **variables and configuration shape**, not a copy of a live cloud environment.

Start with the beginner-first [`../../docs/START-HERE.md`](../../docs/START-HERE.md) workshop. Terraform belongs only after you understand the resource roles and can validate the topology manually once. Use [`../../docs/REFERENCE.md`](../../docs/REFERENCE.md) when you need implementation detail.

## Why this is not one-click CCN provisioning

A cross-border CCN deployment has account-dependent requirements that must be verified before infrastructure automation:

1. Tencent Cloud account and product eligibility;
2. China Mainland / cross-border compliance approval;
3. cross-border bandwidth purchase and billing model;
4. supported API and Terraform-provider coverage at the time of deployment;
5. region, zone, image, instance-family, quota, and capacity availability; and
6. DNS, TLS certificates, security review, logging, monitoring, and rollback ownership.

Do not infer that `terraform apply` alone can obtain or validate cross-border CCN capacity or compliance approval.

## Intended resource topology

```text
China Mainland VPC
  -> ingress CVM + public EIP + Nginx
  -> approved CCN Cross-Border Bandwidth
  -> US VPC
       -> US origin CVM + Nginx + Node ACK service
```

## Safe implementation plan

1. Pin a current Tencent Cloud provider version after checking the provider's official documentation for the target account and regions.
2. Add VPC, subnet, CVM, security-group, and EIP resources using variables from `terraform.tfvars`.
3. Keep actual `terraform.tfvars`, `.terraform/`, and all `terraform.tfstate*` files out of Git.
4. Complete CCN compliance and cross-border bandwidth steps through the approved account workflow.
5. Associate VPCs and verify non-overlapping routes and US VPC endpoint reachability.
6. Deploy the reviewed Nginx example configurations and validate WSS endpoints before generating them in the ignored `runtime-config.js` in the deployed static web root.

The included `terraform.tfvars.example` is intentionally safe to publish. Copy it to `terraform.tfvars` locally and replace all values for your own account.

## Why the public repository stops at a scaffold

This Workshop does **not** ship a default executable `main.tf` for the cross-border topology. A one-command apply could be misunderstood as approval to purchase, expose, or validate cross-border capacity. It also cannot replace account-specific compliance, commercial, security, DNS, certificate, and rollback decisions.

If a maintainer later adds an opt-in foundation module for VPCs, subnets, CVMs, EIPs, and security groups, it should:

- require an explicit `workshop_cost_acknowledged = true` input before apply;
- default to no public SSH access and require a narrow administrator source or managed access pattern;
- use placeholder domains and no default live WSS endpoint;
- exclude cross-border approval, bandwidth purchase, production DNS, and production certificates;
- apply resource tags for Workshop owner and expiry date;
- document `terraform plan -destroy` and the non-Terraform cleanup steps; and
- run `terraform fmt -check` and `terraform validate` in CI, never `terraform apply`.

Read [`../../docs/cost-and-safety.md`](../../docs/cost-and-safety.md) and [`../../docs/cleanup.md`](../../docs/cleanup.md) before using Terraform with any billable account.
