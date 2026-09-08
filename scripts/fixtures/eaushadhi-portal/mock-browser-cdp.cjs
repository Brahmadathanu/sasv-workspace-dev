/* eslint-env node */
/**
 * Minimal Playwright-shaped browser CDP stubs for worker connect() mocks.
 * Mirrors public APIs only: context.browser().newBrowserCDPSession + context.newCDPSession(page).
 */

function attachMockBrowserCdp(context, { getPages } = {}) {
  if (!context || typeof context !== "object") {
    throw new Error("attachMockBrowserCdp requires a context object");
  }
  let seq = 0;
  const pageIds = new WeakMap();

  function listPages() {
    if (typeof getPages === "function") return getPages() || [];
    if (typeof context.pages === "function") return context.pages() || [];
    return [];
  }

  function idFor(page) {
    if (!page) return `orphan-${++seq}`;
    if (!pageIds.has(page)) pageIds.set(page, `mock-target-${++seq}`);
    return pageIds.get(page);
  }

  const browserSession = {
    on() {},
    off() {},
    async send(method, params = {}) {
      if (method === "Target.setDiscoverTargets") return {};
      if (method === "Target.getTargets") {
        return {
          targetInfos: listPages().map((page) => ({
            targetId: idFor(page),
            type: "page",
            url: typeof page.url === "function" ? String(page.url() || "") : "",
          })),
        };
      }
      if (method === "Target.closeTarget") {
        const targetId = String(params.targetId || "");
        const page = listPages().find((candidate) => idFor(candidate) === targetId);
        if (
          page &&
          typeof page.close === "function" &&
          !(typeof page.isClosed === "function" && page.isClosed())
        ) {
          await page.close();
        }
        return { success: true };
      }
      return {};
    },
    async detach() {},
  };

  context.browser = () => ({
    newBrowserCDPSession: async () => browserSession,
  });
  context.newCDPSession = async (page) => ({
    async send(method) {
      if (method !== "Target.getTargetInfo") {
        throw new Error(`Unexpected page CDP method: ${method}`);
      }
      return {
        targetInfo: {
          targetId: idFor(page),
          type: "page",
          url: typeof page?.url === "function" ? String(page.url() || "") : "",
        },
      };
    },
    async detach() {},
  });
  return context;
}

module.exports = {
  attachMockBrowserCdp,
};
