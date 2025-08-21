// main.js
/* eslint-env node */

// ---------------- Dev auto-reload (no effect in packaged) ----------------
if (process.env.NODE_ENV !== "production") {
  try {
    require("electron-reload")(__dirname);
  } catch (e) {
    // Expected when the package isn't installed (e.g., packaged app)
    console.debug("[dev] electron-reload not available:", e && e.message);
  }
}

// ---------------- Electron & deps ----------------
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const express = require("express");
const htmlToDocx = require("html-to-docx");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  TabStopType,
  TabStopPosition,
  LevelFormat, // for outline numbering, etc.
} = require("docx");
const { autoUpdater } = require("electron-updater");

// ---------------- Small helpers ----------------
const safeName = (s, def = "SOP") =>
  String(s || def).replace(/[\\/:*?"<>|]+/g, "_");

// ---------------- Auto-update events ----------------
autoUpdater.on("checking-for-update", () => {
  dialog.showMessageBox({ type: "info", message: "Checking for updates…" });
});
autoUpdater.on("update-available", (info) => {
  dialog.showMessageBox({
    type: "info",
    message: `Update available: v${info.version}. Downloading…`,
  });
});
autoUpdater.on("update-not-available", () => {
  dialog.showMessageBox({
    type: "info",
    message: "No update available (you’re on the latest version).",
  });
});
autoUpdater.on("error", (err) => {
  dialog.showErrorBox("Update error", (err && err.message) || "Unknown error");
});
autoUpdater.on("download-progress", (p) => {
  console.log(`Download speed: ${p.bytesPerSecond}
Downloaded ${Math.round(p.percent)}%
(${p.transferred}/${p.total})`);
});
autoUpdater.on("update-downloaded", (info) => {
  dialog
    .showMessageBox({
      type: "question",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      message: `v${info.version} downloaded — restart to install?`,
    })
    .then(({ response }) => response === 0 && autoUpdater.quitAndInstall());
});

// ---------------- Static server (http://localhost:3000) ----------------
const webApp = express();
webApp.use(express.static(path.join(__dirname)));
webApp.listen(3000, () =>
  console.log("Static server at http://localhost:3000")
);

// ---------------- Main window ----------------
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL("http://localhost:3000/login.html");
}

// simple helpers exposed via IPC
ipcMain.on("focus-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.focus();
});

ipcMain.on("open-module-url", (event, { absUrl, opts = {} }) => {
  try {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const child = new BrowserWindow({
      width: opts.width || 1200,
      height: opts.height || 800,
      parent,
      modal: false,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
      },
    });
    const targetUrl = /^https?:|^file:/i.test(absUrl)
      ? absUrl
      : new URL(absUrl, "http://localhost:3000/").toString();
    child.loadURL(targetUrl);
  } catch (err) {
    console.error("open-module-url failed:", err);
  }
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ---------------- App lifecycle ----------------
app.whenReady().then(() => {
  createWindow();
  try {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Brahmadathanu",
      repo: "sasv-workspace-dev",
      private: false,
      token: null,
    });
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.log("Auto-update skipped (dev mode):", err.message);
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ======================================================================
// ============== EXPORTS (PDF & DOCX) — unified, robust ================
// ======================================================================

// ---- 1) Snapshot PDF of the CURRENT window (legacy) -------------------
ipcMain.handle("sop:export-pdf", async (event, { title }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const pdf = await win.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: "A4",
      landscape: false,
    });
    return {
      ok: true,
      pdfBase64: pdf.toString("base64"),
      suggestedName: safeName(`${title || "SOP"}.pdf`),
    };
  } catch (e) {
    return { ok: false, error: e?.message || "printToPDF failed" };
  }
});

// ---- 2) PDF from provided HTML (preferred) ----------------------------
async function pdfFromHtml({ title, html, options = {} }) {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });

    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    await win.loadURL(dataUrl);

    const pdfBuf = await win.webContents.printToPDF({
      pageSize: options.pageSize || "A4",
      landscape: !!options.landscape,
      printBackground: options.printBackground !== false,
      displayHeaderFooter: !!options.displayHeaderFooter,
      headerTemplate: options.headerTemplate || "",
      footerTemplate: options.footerTemplate || "",
      margins: options.margins || undefined,
    });

    // Prefer explicit fileStem, then SOP number in meta, then title, then "SOP"
    const stem = safeName(
      options?.fileStem ||
        (options?.meta &&
          (options.meta.sop_number ||
            options.meta.sop_no ||
            options.meta.sop_code)) ||
        title ||
        "SOP"
    );

    return {
      ok: true,
      pdfBase64: pdfBuf.toString("base64"),
      suggestedName: `${stem}.pdf`,
    };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

// Primary (camelCase) + legacy (kebab) channels
ipcMain.handle("sop:exportPdfFromHtml", (_evt, payload) =>
  pdfFromHtml(payload)
);
ipcMain.handle("sop:export-pdf-from-html", (_evt, payload) =>
  pdfFromHtml(payload)
);

// ---- 3) DOCX from provided HTML (preferred) ---------------------------
async function docxFromHtml(payload) {
  const { title, html, options = {} } = payload || {};
  try {
    const buffer = await htmlToDocx(html, null, {
      table: { row: { cantSplit: true } },
      pageNumber: !!options.pageNumber,
      footer: !!options.footer,
    });

    // Prefer explicit fileStem, then any SOP number in meta, then title
    const stem = safeName(
      payload?.fileStem ||
        payload?.meta?.sop_number ||
        payload?.meta?.sop_no ||
        payload?.meta?.sop_code ||
        title ||
        "SOP"
    );

    return {
      ok: true,
      docxBase64: Buffer.from(buffer).toString("base64"),
      suggestedName: `${stem}.docx`,
    };
  } catch (e) {
    return { ok: false, error: e?.message || "DOCX conversion failed" };
  }
}

// Primary channel used by the new viewer code
ipcMain.handle("sop:exportDocxFromHtml", (_evt, payload) =>
  docxFromHtml(payload)
);

// Legacy alias (same signature: { title, html })
ipcMain.handle("sop:export-docx", (_evt, payload) => docxFromHtml(payload));

// ---- 4) Legacy “native” DOCX (markdown) — now routed via HTML bridge ---
/**
 * Old callers send: { title, meta, markdown }
 * We convert Markdown → HTML here and feed into html-to-docx so you never
 * get raw **asterisks** in Word again.
 */
ipcMain.handle(
  "sop:export-docx-native",
  async (_evt, { title, meta, markdown }) => {
    try {
      // ---------- helpers ----------
      const cap = (s) =>
        s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—";
      const fmt = (d) => {
        if (!d) return "—";
        const dt = new Date(d);
        return dt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };
      const safeName = (s) => (s || "SOP").replace(/[\\/:*?"<>|]+/g, "_");

      const typeLabelStr = (() => {
        const code = meta?.type_code || "";
        const name = meta?.type_name || "";
        if (!code && !name) return "—";
        return name ? `${name} (${code})` : code;
      })();

      // ---------- header / footer ----------
      const header = new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: meta?.sop_number || "",
                font: "Arial",
                size: 20,
              }),
              new TextRun({ text: "\t", font: "Arial", size: 20 }),
              new TextRun({
                text: meta?.title || title || "SOP",
                font: "Arial",
                size: 20,
              }),
            ],
            tabStops: [
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
          }),
        ],
      });

      const footer = new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 18 }),
              PageNumber.CURRENT,
              new TextRun({ text: " of ", font: "Arial", size: 18 }),
              PageNumber.TOTAL_PAGES,
            ],
          }),
        ],
      });

      // ---------- default styles & numbering ----------
      const numbering = {
        config: [
          {
            reference: "ol",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } }, // 0.5" left, 0.25" hanging
              },
            ],
          },
          {
            reference: "ul",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "•",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      };

      // ---------- title ----------
      const titlePara = new Paragraph({
        text: meta?.title || title || "SOP",
        heading: HeadingLevel.TITLE,
        spacing: { after: 160 },
      });

      // ---------- meta table ----------
      // Wider value columns to reduce wrapping
      const wL = 2400; // label col (DXA)
      const wV = 3600; // value col (DXA)

      const makeCell = (text, { isLabel = false, widthDxa = wV } = {}) =>
        new TableCell({
          width: { size: widthDxa, type: WidthType.DXA },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text ?? (isLabel ? "" : "—"),
                  bold: !!isLabel,
                }),
              ],
              spacing: { before: 40, after: 40 },
              alignment: AlignmentType.LEFT,
            }),
          ],
        });

      const metaRows = [
        ["SOP No.", meta?.sop_number || "—", "Version", meta?.version || "—"],
        ["Status", cap(meta?.status || "—"), "Type", typeLabelStr],
        [
          "Kind",
          meta?.kind_name
            ? meta?.kind_code
              ? `${meta.kind_name} (${meta.kind_code})`
              : meta.kind_name
            : "—",
          "Created on",
          fmt(meta?.created_at),
        ],
        [
          "Updated on",
          fmt(meta?.updated_at),
          "Created by",
          meta?.created_by_name || "—",
        ],
        ["Updated by", meta?.updated_by_name || "—", "", ""],
      ];

      const metaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        // no borders for a cleaner look
        rows: metaRows.map(
          (cells) =>
            new TableRow({
              children: [
                makeCell(cells[0], { isLabel: true, widthDxa: wL }),
                makeCell(cells[1], { widthDxa: wV }),
                makeCell(cells[2], { isLabel: true, widthDxa: wL }),
                makeCell(cells[3], { widthDxa: wV }),
              ],
            })
        ),
      });

      // ---------- markdown → paragraphs (justified, real lists, bold/italic/inline code) ----------
      function inlineRuns(txt) {
        // very small inline **bold**, *italic*, `code`
        const runs = [];
        let s = String(txt);

        // links → "text (url)"
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");

        // handle code first
        const CODE = /`([^`]+)`/g;
        let last = 0;
        let m;
        const pushText = (t) => {
          if (!t) return;
          // bold then italic
          const parts = [];
          let tmp = t;

          // bold
          tmp = tmp.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
          tmp.forEach((chunk) => {
            if (/^\*\*[^*]+\*\*$/.test(chunk)) {
              parts.push({ text: chunk.slice(2, -2), bold: true });
            } else {
              // italic inside the non-bold chunk
              const ital = chunk.split(/(\*[^*]+\*)/g).filter(Boolean);
              ital.forEach((c) => {
                if (/^\*[^*]+\*$/.test(c))
                  parts.push({ text: c.slice(1, -1), italics: true });
                else parts.push({ text: c });
              });
            }
          });

          parts.forEach((p) =>
            runs.push(
              new TextRun({
                text: p.text,
                bold: !!p.bold,
                italics: !!p.italics,
              })
            )
          );
        };

        while ((m = CODE.exec(s))) {
          pushText(s.slice(last, m.index));
          runs.push(
            new TextRun({ text: m[1], font: "Courier New" }) // inline code
          );
          last = m.index + m[0].length;
        }
        pushText(s.slice(last));
        return runs.length ? runs : [new TextRun({ text: s })];
      }

      function mdToDocxParas(md) {
        const out = [];
        const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
        let inCode = false;
        let codeBuf = [];

        const para = (children, opts = {}) =>
          new Paragraph({
            children,
            spacing: { before: 80, after: 80 },
            alignment: AlignmentType.JUSTIFIED, // ← requested
            ...opts,
          });

        for (let raw of lines) {
          const line = raw;

          // fences
          if (/^```/.test(line)) {
            if (!inCode) {
              inCode = true;
              codeBuf = [];
            } else {
              out.push(
                new Paragraph({
                  spacing: { before: 160, after: 160 },
                  children: [
                    new TextRun({
                      text: codeBuf.join("\n"),
                      font: "Courier New",
                    }),
                  ],
                })
              );
              inCode = false;
            }
            continue;
          }
          if (inCode) {
            codeBuf.push(line);
            continue;
          }

          // headings
          const h = /^(#{1,6})\s+(.*)$/.exec(line);
          if (h) {
            const lvl = h[1].length;
            const txt = h[2].trim();
            const heading =
              lvl === 1
                ? HeadingLevel.HEADING_1
                : lvl === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3;

            out.push(
              new Paragraph({
                text: txt,
                heading, // ← actually use the computed heading
                spacing: { before: 200, after: 100 },
                keepNext: true, // keep heading with the next paragraph
              })
            );
            continue;
          }

          // ordered list: 1. item
          const ol = /^(\d+)\.\s+(.*)$/.exec(line);
          if (ol) {
            out.push(
              new Paragraph({
                children: inlineRuns(ol[2]),
                numbering: { reference: "ol", level: 0 },
                spacing: { before: 40, after: 40 },
                alignment: AlignmentType.JUSTIFIED,
              })
            );
            continue;
          }

          // unordered list: - item  or * item
          const ul = /^[-*]\s+(.*)$/.exec(line);
          if (ul) {
            out.push(
              new Paragraph({
                children: inlineRuns(ul[1]),
                bullet: { level: 0 }, // simpler than a numbering ref for bullets
                spacing: { before: 40, after: 40 },
                alignment: AlignmentType.JUSTIFIED,
              })
            );
            continue;
          }

          // blank
          if (/^\s*$/.test(line)) {
            out.push(new Paragraph({ text: "" }));
            continue;
          }

          // normal paragraph
          out.push(para(inlineRuns(line)));
        }

        // unclosed code fence
        if (inCode && codeBuf.length) {
          out.push(
            new Paragraph({
              spacing: { before: 160, after: 160 },
              children: [
                new TextRun({ text: codeBuf.join("\n"), font: "Courier New" }),
              ],
            })
          );
        }
        return out;
      }

      // ---------- build document ----------
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: "Arial", size: 22 }, // 11pt
              paragraph: {
                spacing: { line: 276, before: 0, after: 160 }, // 1.5 line
                alignment: AlignmentType.JUSTIFIED,
              },
            },
            heading1: { run: { font: "Arial", size: 30, bold: true } }, // ~15pt
            heading2: { run: { font: "Arial", size: 26, bold: true } }, // ~13pt
            heading3: { run: { font: "Arial", size: 24, bold: true } },
          },
        },
        numbering,
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1134, right: 850, bottom: 1134, left: 850 }, // 20mm x 15mm
                size: { width: 11906, height: 16838 }, // A4 portrait
              },
            },
            headers: { default: header },
            footers: { default: footer },
            children: [titlePara, metaTable, ...mdToDocxParas(markdown || "")],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      // ---------- consistent filename: SOP number (fallback safe) ----------
      const fileStem = safeName(meta?.sop_number || title);
      return {
        ok: true,
        docxBase64: Buffer.from(buffer).toString("base64"),
        suggestedName: `${fileStem}.docx`,
      };
    } catch (e) {
      return { ok: false, error: e?.message || "DOCX build failed" };
    }
  }
);
