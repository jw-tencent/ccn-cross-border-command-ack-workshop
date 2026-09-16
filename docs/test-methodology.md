# Test methodology

## Functional validation

1. Load the static page without configured endpoints. Both paths must display a clearly labeled simulation state.
2. Configure a reviewed Direct WSS endpoint. Send one command and verify exactly one matched ACK sample is recorded.
3. Configure a distinct reviewed routed WSS endpoint. Verify the routed connection state, then send one command and verify exactly one routed application ACK sample is recorded.
4. Disconnect either endpoint or force an error. The UI must display an unavailable state and create no successful RTT sample.
5. Run a batch test for each path separately. Commands must be sequential and the histories must remain separate.

## Comparison method

Use the same:

- China Mainland client and access network;
- browser and browser version;
- exact application build and payload;
- US origin and backend version; and
- time window and command count.

Record both successes and failures. Do not discard failures to create a performance narrative.

## Reporting format

Any customer-facing result should state the test date, client location and network type, endpoint condition, sample size, failure count, raw application RTT distribution, and the boundaries described in `architecture.md`.
