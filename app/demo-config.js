/*
 * Public-safe default deployment configuration.
 *
 * Leave both endpoint values empty in the repository. A deployer can copy
 * demo-config.example.js and provide reviewed, credential-free WSS endpoints.
 */
window.CCN_DEMO_CONFIG = Object.freeze({
  directWs: "",
  ccnPathWs: "",
  defaultMode: "direct",
});
