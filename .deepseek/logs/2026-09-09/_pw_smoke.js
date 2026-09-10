const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "C:\\Users\\brand\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe" });
  const p = await b.newPage();
  await p.setContent("<div id='x' style='color:red'>hola</div>");
  const c = await p.$eval("#x", (el) => getComputedStyle(el).color);
  console.log("color leido:", c);
  await b.close();
  console.log("OK smoke test");
})().catch((e) => { console.error("FALLO smoke test:", e); process.exit(1); });
