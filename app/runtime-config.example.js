/*
 * Deployment example only. Copy this to runtime-config.js in the deployed
 * static web root, then replace example.com with reviewed WSS hostnames.
 * runtime-config.js is intentionally ignored by Git. Never place credentials,
 * access tokens, private IP addresses, or production-only secrets in it.
 */
window.CCN_DEMO_CONFIG = Object.freeze({
  /* Browser page on the Direct host -> Public Internet -> US Nginx -> ACK service */
  directWs: "wss://demo.example.com/ws",

  /* Browser page on the Direct host -> Guangzhou ingress -> CCN -> US VPC endpoint -> ACK service */
  ccnPathWs: "wss://ccn-path.example.com/ws",

  defaultMode: "direct",
});
