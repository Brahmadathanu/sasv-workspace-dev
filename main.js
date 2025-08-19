// main.js
/* eslint-env node */

// Auto-reload the app when any file under the project changes (dev only)
try {
  require("electron-reload")(__dirname, {
    // Optional tweaks:
    //   electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    //   hardResetMethod: 'exit'
  });
} catch {
  /* ignore when packaged */
}

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const express = require("express");
const htmlToDocx = require("html-to-docx");

// Auto-update (checks GitHub Releases)
const { autoUpdater } = require("electron-updater");

//
// ── AUTO‐UPDATE EVENT LISTENERS ───────────────────────────────────────
//
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
autoUpdater.on("download-progress", (progress) => {
  console.log(`Download speed: ${progress.bytesPerSecond}
Downloaded ${Math.round(progress.percent)}%
(${progress.transferred}/${progress.total})`);
});
autoUpdater.on("update-downloaded", (info) => {
  dialog
    .showMessageBox({
      type: "question",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      message: `v${info.version} downloaded — restart to install?`,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

//
// ── serve files over HTTP on port 3000 ────────────────────────────────
//
const webApp = express();
webApp.use(express.static(path.join(__dirname)));
webApp.listen(3000, () => {
  console.log("Static server running at http://localhost:3000");
});

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

  // load via HTTP now, not file://
  mainWindow.loadURL("http://localhost:3000/login.html");
}

ipcMain.on("focus-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.focus();
});

// Opens a child window to an absolute URL sent from the renderer (preload -> openModuleUrl)
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

    // If renderer sent a relative path by mistake, resolve it to your server root.
    const targetUrl = /^https?:|^file:/i.test(absUrl)
      ? absUrl
      : new URL(absUrl, "http://localhost:3000/").toString();

    child.loadURL(targetUrl);
  } catch (err) {
    console.error("open-module-url failed:", err);
  }
});

// ── make app version available to renderer ──
ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(() => {
  // 1) create the main window
  createWindow();

  // 2) in packaged builds, check GitHub for a newer version
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
    // During `npm run dev` this will throw because the app isn’t packaged.
    // We log and keep going so it won’t spam your console.
    console.log("Auto-update skipped (dev mode):", err.message);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
// === Export handlers (PDF snapshot, PDF from HTML, DOCX) ===================

// 1) Legacy snapshot PDF (kept for fallback if you still call it elsewhere)
ipcMain.handle("sop:export-pdf", async (event, { title }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const pdf = await win.webContents.printToPDF({
      marginsType: 1, // default margins
      printBackground: true, // keep CSS backgrounds
      pageSize: "A4",
      landscape: false,
    });
    return {
      ok: true,
      pdfBase64: pdf.toString("base64"),
      suggestedName: `${title || "SOP"}.pdf`,
    };
  } catch (e) {
    return { ok: false, error: e?.message || "printToPDF failed" };
  }
});

// 2) Professional PDF from dedicated HTML (used by the new Export ▾ → PDF)
ipcMain.handle(
  "sop:export-pdf-from-html",
  async (_evt, { title, html, options }) => {
    let win;
    try {
      win = new BrowserWindow({
        show: false,
        // Offscreen avoids flashing a window; no preload needed here
        webPreferences: { offscreen: true },
      });

      const dataUrl =
        "data:text/html;charset=utf-8," + encodeURIComponent(html);
      await win.loadURL(dataUrl);

      const pdfBuf = await win.webContents.printToPDF({
        pageSize: options?.pageSize || "A4",
        landscape: !!options?.landscape,
        printBackground: options?.printBackground !== false,
        displayHeaderFooter: !!options?.displayHeaderFooter,
        headerTemplate: options?.headerTemplate || "",
        footerTemplate: options?.footerTemplate || "",
      });

      return {
        ok: true,
        pdfBase64: pdfBuf.toString("base64"),
        suggestedName: `${title || "SOP"}.pdf`,
      };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  }
);

// 3) DOCX export from HTML template
ipcMain.handle("sop:export-docx", async (_event, { title, html }) => {
  try {
    const buffer = await htmlToDocx(html, null, {
      // Safe, readable defaults
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    });
    return {
      ok: true,
      docxBase64: Buffer.from(buffer).toString("base64"),
      suggestedName: `${title || "SOP"}.docx`.replace(/[\\/:*?"<>|]+/g, "_"),
    };
  } catch (e) {
    return { ok: false, error: e?.message || "DOCX conversion failed" };
  }
});
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
} = require("docx");

ipcMain.handle(
  "sop:export-docx-native",
  async (_evt, { title, meta, markdown }) => {
    try {
      // Helpers
      const cap = (s) =>
        s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";
      const fmt = (d) => {
        if (!d) return "—";
        const dt = new Date(d);
        return dt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };
      const typeLabelStr = (() => {
        const code = meta?.type_code || "";
        const name = meta?.type_name || "";
        if (!code && !name) return "—";
        return name ? `${name} (${code})` : code;
      })();

      // Header (left: SOP No., right: Title)
      const header = new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: meta?.sop_number || "",
                font: "Arial",
                size: 18,
              }),
              new TextRun({ text: "\t", font: "Arial", size: 18 }),
              new TextRun({
                text: meta?.title || title || "SOP",
                font: "Arial",
                size: 18,
              }),
            ],
            tabStops: [
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
          }),
        ],
      });

      // Footer (page X of Y)
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

      // Title
      const titlePara = new Paragraph({
        text: meta?.title || title || "SOP",
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
        font: "Arial",
      });

      // Meta table (4 columns: 20/30/20/30%)
      const wL = 2000; // label column width (DXA)
      const wV = 3000; // value column width (DXA)

      // helper to build a cell with margins and paragraph spacing (taller rows)
      function makeCell(text, opts = {}) {
        const { isLabel = false, widthDxa = wV } = opts;
        return new TableCell({
          width: { size: widthDxa, type: WidthType.DXA },
          // add vertical breathing room
          margins: { top: 120, bottom: 120, left: 80, right: 80 }, // ~6pt top/bottom
          children: [
            new Paragraph({
              spacing: { before: 60, after: 60 }, // extra ~3pt before/after
              children: [
                new TextRun({
                  text: text ?? (isLabel ? "" : "—"),
                  bold: !!isLabel,
                  font: "Arial",
                }),
              ],
            }),
          ],
        });
      }

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
          "Author",
          meta?.author || "—",
        ],
        [
          "Created on",
          fmt(meta?.created_at),
          "Last updated on",
          fmt(meta?.updated_at),
        ],
        ["Last Reviewer", meta?.last_reviewer || "—", "", ""],
      ];

      const metaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: metaRows.map(
          (cells) =>
            new TableRow({
              children: [
                makeCell(cells[0], { isLabel: true, widthDxa: wL }),
                makeCell(cells[1], { isLabel: false, widthDxa: wV }),
                makeCell(cells[2], { isLabel: true, widthDxa: wL }),
                makeCell(cells[3], { isLabel: false, widthDxa: wV }),
              ],
            })
        ),
      });

      // Minimal Markdown → docx paragraphs (headings, bullets, code blocks, paragraphs, links simplified)
      const paras = markdownToDocx(markdown || "");

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 20mm
                size: { width: 11906, height: 16838 }, // A4 portrait in DXA
              },
            },
            headers: { default: header },
            footers: { default: footer },
            children: [titlePara, metaTable, ...paras],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      return {
        ok: true,
        docxBase64: Buffer.from(buffer).toString("base64"),
        suggestedName: `${meta?.sop_number || title || "SOP"}.docx`.replace(
          /[\\/:*?"<>|]+/g,
          "_"
        ),
      };
    } catch (e) {
      return { ok: false, error: e?.message || "DOCX build failed" };
    }

    // --- tiny inline converter ---
    function markdownToDocx(md) {
      const out = [];
      const lines = String(md)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

      let inCode = false;
      let codeBuf = [];

      const linkify = (t) =>
        t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");

      for (let raw of lines) {
        const line = raw;

        // code fences
        if (/^```/.test(line)) {
          if (!inCode) {
            inCode = true;
            codeBuf = [];
          } else {
            // close
            out.push(
              new Paragraph({
                spacing: { before: 120, after: 120 },
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
          const txt = linkify(h[2].trim());
          const heading =
            lvl === 1
              ? HeadingLevel.HEADING_1
              : lvl === 2
              ? HeadingLevel.HEADING_2
              : lvl === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_3;
          out.push(
            new Paragraph({
              text: txt,
              heading,
              spacing: { before: 240, after: 120 },
            })
          );
          continue;
        }

        // bullets (simple)
        const m = /^[-*]\s+(.*)$/.exec(line);
        if (m) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: "• " + linkify(m[1]), font: "Arial" }),
              ],
              spacing: { before: 60, after: 60 },
            })
          );
          continue;
        }

        // blank line
        if (/^\s*$/.test(line)) {
          out.push(
            new Paragraph({ text: "", spacing: { before: 0, after: 0 } })
          );
          continue;
        }

        // paragraph
        out.push(
          new Paragraph({
            children: [new TextRun({ text: linkify(line), font: "Arial" })],
          })
        );
      }

      // if code fence wasn’t closed, flush it
      if (inCode && codeBuf.length) {
        out.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({ text: codeBuf.join("\n"), font: "Courier New" }),
            ],
          })
        );
      }
      return out;
    }
  }
);
