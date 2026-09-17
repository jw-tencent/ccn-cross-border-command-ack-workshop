# Public GitHub release checklist

Use this checklist immediately before creating or pushing a public GitHub repository.

## Release scope

Publish only the sanitized Workshop repository root. Do not rename or copy a live deployment workspace into this public repository.

Do **not** copy the live deployment workspace or any production server directory into the public repository.

## Pre-push checks

```text
[ ] `app/runtime-config.js` is absent from Git and is listed in `.gitignore`
[ ] `app/runtime-config.example.js` uses placeholder domains only
[ ] No public/private IP addresses, production domains, account IDs, or cloud resource IDs remain
[ ] No `.env`, certificates, private keys, Terraform state, Terraform plans, or local tfvars remain
[ ] `.gitignore` covers secrets, deployment-local configuration, and Terraform state
[ ] `npm run smoke` passes
[ ] README links to Start Here, verification, cost/safety, cleanup, and Terraform guidance
[ ] Public wording calls results functional/application ACK validation, not performance claims
[ ] Terraform is clearly marked as a reference scaffold, not one-click cross-border provisioning
[ ] License and SECURITY.md are present
```

## Suggested GitHub repository settings

- Visibility: **Public** only after the pre-push checks pass.
- Default branch: `main`.
- Enable secret scanning and push protection when available.
- Require pull requests for future changes if the repository will be maintained by multiple contributors.
- Do not grant cloud-account credentials to GitHub Actions for this public Workshop.
- CI should run tests and validation only. It must not provision or destroy cloud resources.

## Suggested first commit workflow

Run these commands from the sanitized repository root after creating an empty GitHub repository in your own account or organization:

```bash
git init -b main
git add .
git status
git commit -m "Initial public CCN workshop release"
git remote add origin https://github.com/ORG_OR_USER/REPOSITORY.git
git push -u origin main
```

Before the `git commit`, inspect `git status` and `git diff --cached` manually. Stop if any real environment reference, credential, customer material, or generated state file appears.

## Post-push validation

1. Open the GitHub repository as an unauthenticated viewer.
2. Confirm `app/runtime-config.js` is not tracked and `app/runtime-config.example.js` contains placeholder values only.
3. Check that GitHub renders `README.md` and all learning links correctly.
4. Confirm GitHub Actions passes without cloud credentials.
5. Search the GitHub repository for your former production domain, EIPs, account IDs, and resource IDs.
6. Download the repository ZIP from GitHub and repeat the local secret/reference scan.

## Release boundary statement

Use this wording in the GitHub repository description or release notes:

> This Workshop demonstrates CCN-oriented topology and Command-to-ACK functional validation. It does not provide cross-border approval, production deployment automation, pricing, an SLA, or a performance guarantee.
