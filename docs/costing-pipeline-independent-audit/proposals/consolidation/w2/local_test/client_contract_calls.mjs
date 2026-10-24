import { rpcCall, RPC } from "/workspace/w2client/public/shared/js/costing-period-governance.js";
const I={reason:"Client contract end-to-end test",approvalReference:"W2-CLIENT-E2E"}; const N={period_start:"2026-11-01"};
const seq=[["editor",rpcCall({id:"open"},null,{...I,valuationDate:"2026-11-05"})],["SIM","141"],["owner",{name:RPC.preflight,params:{p_refresh_run_id:141,p_mode:"APPROVE"}}],
["owner",rpcCall({id:"approve",runId:141},N,I)],["editor",rpcCall({id:"lock"},N,I)],["editor",rpcCall({id:"reopen"},N,I)],["owner",rpcCall({id:"authorise"},N,I)],["SIM","144"],
["owner",rpcCall({id:"supersede",runId:144},N,I)],["editor",rpcCall({id:"lock"},N,I)],["owner",rpcCall({id:"close"},N,I)],["owner",{name:RPC.context,params:{}}]];
console.log(JSON.stringify(seq));
