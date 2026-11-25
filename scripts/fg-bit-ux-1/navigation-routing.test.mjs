import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fg = readFileSync(new URL("../../public/shared/js/fg-bulk-internal-transfer.js", import.meta.url), "utf8");
const platformSource = readFileSync(new URL("../../public/shared/js/platform.js", import.meta.url), "utf8");
const { Platform } = await import("data:text/javascript;base64," + Buffer.from(platformSource).toString("base64"));

test("FG transfer HOME uses canonical platform navigation, not file protocol", () => {
  assert.match(fg, /import\s*\{\s*Platform\s*\}\s*from\s*["']\.\/platform\.js["']/);
  assert.match(fg, /els\.homeBtn\.addEventListener\([\s\S]*?Platform\.goHome\(\)/);
  assert.doesNotMatch(fg, /window\.location\.protocol\s*===\s*["']file:["']/);
});

test("FG transfer session redirects distinguish Electron login from PWA hub", () => {
  assert.match(fg, /if\s*\(!session\)[\s\S]*?window\.location\.href\s*=\s*Platform\.isElectron\s*\?\s*["']\/login\.html["']\s*:\s*["']\/utilities-hub\/index\.html["']/);
});

test("shared HOME resolves local HTTP Electron and hosted PWA correctly", () => {
  const oldWindow = globalThis.window;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    const location = { href: "http://localhost:3000/public/shared/fg-bulk-internal-transfer.html" };
    globalThis.window = { electronAPI: {}, location };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Chrome Electron/45.4.1" } });
    assert.equal(Platform.isElectron, true);
    Platform.goHome();
    assert.equal(location.href, "/index.html");

    delete globalThis.window.electronAPI;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Chrome" } });
    location.href = "https://example.test/shared/fg-bulk-internal-transfer.html";
    assert.equal(Platform.isElectron, false);
    Platform.goHome();
    assert.equal(location.href, "/utilities-hub/index.html");
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
});
