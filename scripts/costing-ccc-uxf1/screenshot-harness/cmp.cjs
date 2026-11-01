const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const [a, b] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const toData = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
  const res = await page.evaluate(async ([da, db]) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(da), load(db)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { same: false, reason: `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    const c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height; const x = c.getContext("2d");
    x.drawImage(ia, 0, 0); const pa = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const pb = x.getImageData(0, 0, c.width, c.height).data;
    let diff = 0; for (let i = 0; i < pa.length; i += 4) if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) diff += 1;
    return { same: diff === 0, differingPixels: diff, size: `${ia.width}x${ia.height}` };
  }, [toData(a), toData(b)]);
  console.log(JSON.stringify(res));
  await browser.close();
})();
