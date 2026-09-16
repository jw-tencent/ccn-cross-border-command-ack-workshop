/*
 * Example only. Replace example.com during deployment; never put credentials,
 * access tokens, private IP addresses, or production-only hostnames here.
 */
window.CCN_DEMO_CONFIG = Object.freeze({
  /* Browser -> Public Internet -> US ACK service */
  directWs: "wss://demo.example.com/ws",

  /* Browser -> China Mainland ingress -> CCN -> US private-origin ACK service */
  ccnPathWs: "wss://ccn-path.example.com/ws",

  defaultMode: "direct",
});
