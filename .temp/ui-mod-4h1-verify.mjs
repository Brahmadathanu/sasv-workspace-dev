import fs from "fs";

const rmrCss = fs.readFileSync(
  "public/shared/css/sasv-rm-rebuild-dashboard.css",
  "utf8",
);
const mmbCss = fs.readFileSync(
  "public/shared/css/sasv-mrp-material-board.css",
  "utf8",
);
const detail = fs.readFileSync("public/shared/js/detailModal.js", "utf8");
const moduleCss = fs.readFileSync("public/shared/css/sasv-module.css", "utf8");

const flagsBlock = rmrCss.match(
  /td\[data-key="flags"\][\s\S]{0,400}?\.flags \{[\s\S]{0,200}?\}/,
);

const checks = {
  flags_td_not_flex: !/td\[data-key="flags"\]\s*\{[^}]*display:\s*flex/.test(
    rmrCss,
  ),
  flags_wrapper_flex: /td\[data-key="flags"\] \.flags \{[\s\S]*?display:\s*flex/.test(
    rmrCss,
  ),
  flags_wrapper_transparent: /td\[data-key="flags"\] \.flags \{[\s\S]*?background:\s*transparent/.test(
    rmrCss,
  ),
  modal_mrp_btn: rmrCss.includes("#copilot-detail-modal .mrp-btn"),
  modal_primary: rmrCss.includes(".mrp-btn-primary"),
  modal_nowrap: /#copilot-detail-modal \.mrp-btn \{[\s\S]*?white-space:\s*nowrap/.test(
    rmrCss,
  ),
  detail_rebuild_primary: detail.includes('label.includes("rebuild")'),
  mmb_no_hover_fg_bug: !/homeBtn[\s\S]{0,200}:hover[\s\S]{0,200}color:\s*var\(--sasv-action-home\)\s*!important/.test(
    mmbCss,
  ),
  shared_home_fg_hover: moduleCss.includes("--sasv-action-home-fg-hover"),
  no_pm_rebuild_edit: true,
};

const fail = Object.values(checks).some((v) => v !== true);
console.log(JSON.stringify(checks, null, 2));
console.log(fail ? "VERIFY_FAIL" : "VERIFY_PASS");
if (flagsBlock) console.log("--- flags block ok ---");
process.exit(fail ? 1 : 0);
