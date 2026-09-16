# Workshop cleanup and cost stop procedure

Use this procedure after every Workshop lab. It is designed to reduce the chance of leaving billable resources or public endpoints running.

> **Important:** Deleting a CVM does not necessarily release its EIP, disks, snapshots, images, CCN bandwidth configuration, certificates, DNS records, or other billable resources. Review the current console and billing views for your account.

## Before you remove cloud resources

1. Record the Workshop outcome, validation scope, and any failed checks in your approved project location.
2. Remove the live routed endpoint from the deployed browser configuration:

   ```js
   ccnPathWs: ""
   ```

3. Publish that configuration update before removing the Guangzhou ingress. This prevents a customer-facing page from attempting to reach a deleted endpoint.
4. Confirm that the Direct baseline is either intentionally retained or also scheduled for removal.
5. Verify no shared production workload is attached to the CCN, VPCs, security groups, or public EIPs used by the Workshop.

## Recommended cleanup order

### 1. Remove public exposure

- Remove the routed DNS record, or point it to an approved holding page if DNS ownership requires retention.
- Revoke or retire the routed TLS certificate according to your certificate-management policy.
- Remove public `80` and `443` security-group rules from the Guangzhou ingress when no longer required.
- Confirm that the ingress root path and non-public paths do not expose project files.

### 2. Release compute and public IP resources

- Terminate the Guangzhou ingress CVM after confirming no active use.
- Explicitly release the Guangzhou EIP.
- If the US origin is Workshop-only, terminate its CVM and explicitly release its public EIP.
- Review and delete unattached cloud disks, snapshots, custom images, elastic network interfaces, and unused security groups created for the lab.

### 3. Remove private connectivity resources

- Remove or set the Guangzhou-to-Silicon-Valley CCN bandwidth configuration according to the current account workflow.
- Disassociate Workshop VPCs from the CCN only after confirming no other network instance depends on it.
- Delete the Workshop CCN instance only after every attached network instance has been reviewed and removed.
- Delete Workshop VPCs and subnets only after all dependent CVMs, network interfaces, routes, and other services are removed.

### 4. Verify cost stop

In the Tencent Cloud console, review the relevant regional billing and resource lists for:

```text
CVM
EIP / public IP
cloud disks and snapshots
public-network traffic
CCN and cross-border bandwidth
load balancers, NAT gateways, and certificates if created
```

Document the time that resources were released. Current charges, settlement timing, and retained-resource behavior vary by account, region, SKU, and billing model.

## Terraform users

If you used Terraform for a Workshop foundation layer:

1. Run `terraform plan -destroy` and review every resource before applying a destroy operation.
2. Use `terraform destroy` only for resources owned solely by the Workshop state.
3. Do not assume Terraform destroys resources created manually through the console, resources imported from shared environments, or cross-border approval/bandwidth configurations outside the Terraform state.
4. Keep `terraform.tfstate*` local and protected; never upload it to the public repository.

## Final verification checklist

```text
[ ] Routed endpoint is disabled in deployed browser configuration
[ ] Routed DNS record is removed or intentionally retained
[ ] Public EIPs are released
[ ] Workshop CVMs are terminated
[ ] Unattached disks, snapshots, and images are reviewed
[ ] CCN bandwidth configuration is reviewed or removed
[ ] CCN associations and instance are reviewed or removed
[ ] No production/shared resource was changed accidentally
[ ] Billing/resource console shows no unexpected Workshop resources
```
