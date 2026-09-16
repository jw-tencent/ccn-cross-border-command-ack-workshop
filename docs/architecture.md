# Architecture and evidence boundary

## Direct baseline

```text
Browser -> Public Internet -> US ACK origin
```

The Direct endpoint is the control path. It sends a browser WebSocket command to the acknowledgement service and records a result only after a matching `eventId` ACK returns.

## Configured routed path

```text
Browser -> Guangzhou public ingress -> CCN Cross-Border Bandwidth
        -> US private origin -> Same ACK service
```

The routed endpoint is configured independently of the Direct endpoint. The browser never accepts the routed endpoint from a URL query parameter, and ACK metadata is not accepted as proof of a network route.

## What a successful sample means

```text
performance.now() at command send
  -> matching ACK returned for the same eventId
  -> performance.now() at ACK receipt
```

The resulting value is **Command-to-ACK round-trip application acknowledgement (RTT)**.

## What it does not mean

It is not any of the following:

- one-way latency;
- network RTT or CCN-link latency;
- throughput, jitter, or packet-loss evidence;
- an SLA; or
- a performance guarantee.

## Fair comparison conditions

A customer-relevant Direct versus routed comparison needs the same China Mainland client, browser version, payload, US origin, time window, and test method. A client outside China Mainland can validate functional connectivity but does not represent China Mainland user performance.
