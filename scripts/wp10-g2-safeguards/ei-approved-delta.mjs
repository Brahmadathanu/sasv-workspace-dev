// Owner-approved EI delta, 26 Nov 2026. Exact Git blobs, exact branch, no dirty/untracked exemptions.
export const EI_BRANCH = "claude/upbeat-lovelace-tdc1jm";
export const EI_CLIENT_BLOBS = Object.freeze({
  "public/shared/js/module-registry.js": "817b493389a8a0d1730cfe19b2952a5b65ea59fc",
  "public/shared/executive-mis-dashboard.html": "b3515e9ce71f3b0baa37675329c66fed230b15fb",
  "public/shared/js/executive-mis-dashboard.js": "4910e1dfb0d2570cb7966c9f8660f9da884312a7",
  "public/shared/js/executive-intelligence-model.js": "4ccc27d7dadb43fbe4aef08aafe5d891c45c947e"
});
export const EI_REGISTRY_BASE = "f78f3ba6d1a403cf4b588afc5d285f48df962361";
export function eiClientApproved(path, branch, committedBlob, workingBlob) {
 return branch === EI_BRANCH && Object.hasOwn(EI_CLIENT_BLOBS,path) && committedBlob === EI_CLIENT_BLOBS[path] && workingBlob === committedBlob;
}
export function eiRegistryApproved(path, branch, committedBlob, workingBlob, baseBlob) {
 return path === "public/shared/js/module-registry.js" && baseBlob === EI_REGISTRY_BASE && eiClientApproved(path,branch,committedBlob,workingBlob);
}
