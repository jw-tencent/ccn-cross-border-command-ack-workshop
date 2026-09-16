# Security policy

## Scope

This repository is a reference demo. It must never contain production credentials, SSH keys, TLS private keys, Terraform state, cloud-account identifiers, or live endpoint configuration.

## Reporting a vulnerability

Do not open a public issue for a potential security vulnerability. Contact the repository maintainer privately through the security contact configured in the GitHub repository, and include:

- affected file and version;
- reproduction steps;
- observed impact; and
- any suggested mitigation.

## Deployment requirements

- Keep the Node ACK service bound to loopback and terminate public TLS/WSS at a reviewed reverse proxy.
- Use exact `ALLOWED_ORIGINS`; wildcard Origins are rejected by the included service.
- Use WSS in public deployments.
- Store production endpoint configuration outside Git or through a deployment secret/configuration system.
- Do not expose the project directory as the web root. Publish only static browser assets.
- Treat `/healthz` as an application readiness probe, not a CCN path or performance proof.

## Measurement boundary

A successful Command-to-ACK exchange is application-level RTT only. It is not one-way latency, network RTT, CCN-link latency, throughput, jitter, packet loss, SLA evidence, or a performance guarantee.
