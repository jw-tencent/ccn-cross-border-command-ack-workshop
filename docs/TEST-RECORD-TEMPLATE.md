# Customer test record template: Direct and routed Command-to-ACK validation

Use this template after the Direct and routed endpoints have passed their deployment checks. It records a **functional application-path validation**. It does not create a latency benchmark, CCN-link measurement, SLA statement, or performance guarantee.

> Do not place live endpoint hostnames, public/private IPs, account IDs, credentials, customer personal data, screenshots containing account details, or approval records in the public repository. Store completed customer records only in the approved project location.

## 1. Test scope

| Field | Record |
|---|---|
| Customer/project | |
| Test owner | |
| Technical owner | |
| Test date and time window | |
| Test-client location | China Mainland city/region, if approved to record |
| Test-client network type | For example: office broadband, mobile network, or approved test service |
| Browser and version | |
| US application version / change reference | |
| Command payload and count | |
| Direct endpoint status before test | Connected / unavailable / other |
| Routed endpoint status before test | Connected / unavailable / other |

## 2. Matched test conditions

Confirm all items before interpreting a comparison:

```text
[ ] Same China Mainland client/network for Direct and routed tests
[ ] Same browser and browser version
[ ] Same command payload and command count
[ ] Same US ACK backend version
[ ] Same or closely matched time window
[ ] Both successful and failed commands retained in the record
```

If any box is not checked, label the result **setup validation only**. Do not use it to describe China Mainland user experience or compare path performance.

## 3. Results

| Path | Commands sent | Matching ACKs | Failures / timeouts | Displayed Command-to-ACK RTT observations | Endpoint condition | Notes |
|---|---:|---:|---:|---|---|---|
| Direct control path | | | | | | |
| Configured routed path | | | | | | |

## 4. Functional conclusion

Choose one statement and retain any failed evidence:

- [ ] **Both paths functioned:** Direct and configured routed commands returned matching ACKs under the recorded conditions.
- [ ] **Direct-only functioned:** The Direct control path returned matching ACKs; the routed path requires investigation.
- [ ] **Routed-only functioned:** The routed path returned matching ACKs; the Direct control path requires investigation.
- [ ] **Neither path functioned:** Stop the evaluation and investigate application, endpoint, DNS/TLS, or network configuration.
- [ ] **Inconclusive:** Test conditions were not matched, or a required test input was unavailable.

### Customer-safe wording

> “Under the recorded test conditions, the configured application endpoint returned matching acknowledgements for the commands sent. This is functional application-path evidence only. It is not a standalone statement about CCN-link latency, bandwidth, throughput, jitter, packet loss, SLA, approval status, or guaranteed user experience.”

## 5. Next decision

| Decision | Select when | Owner |
|---|---|---|
| Continue evaluation | Both paths function and the team has a defined production-design question to validate next | Customer/project owner + SA |
| Fix the lab design | A required health check, route, TLS/WSS endpoint, security control, or ACK check fails | Technical owner + network/security owner |
| Review eligibility or commercial prerequisites | Approval, bandwidth, billing, region-pair availability, or account status blocks the intended path | Account/compliance owner + Tencent Cloud account team |
| Stop and clean up | The lab is no longer needed or cannot proceed safely | Customer/project owner |

## 6. Cleanup confirmation

```text
[ ] Routed endpoint removed from deployed browser configuration if the ingress will be removed
[ ] Public exposure, DNS, and certificates reviewed
[ ] EIPs, CVMs, disks, snapshots, CCN bandwidth, associations, and VPCs reviewed
[ ] Billing/resource console checked for remaining workshop resources
[ ] Completed record stored only in the approved project location
```

Follow the complete [cleanup procedure](cleanup.md).
