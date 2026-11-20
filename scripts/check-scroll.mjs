// Reports every place that scrolls on a desktop console, for each page and
// window size. A clean run prints "ok" for every line. Works for the vanilla
// pages (.hw-plate) and the React pages ([data-plate]) alike.
//
//   node scripts/check-scroll.mjs [cpu memory transaction/deadlock.html ...] [--sizes=1100x700,1280x720,1440x900,1920x1080] [--steps=N] [--base=http://127.0.0.1:5173]
//
// Needs a running server (npm run dev, or npm run preview with --base) and
// Chrome (CHROME=path overrides the default Windows path). For each page it
// loads the page, waits for the intro, then steps forward (--steps clicks on
// the "next" key) and checks again, so content that grows during a lesson is
// covered.
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const base = opt("base", "http://127.0.0.1:5173");
const sizes = opt("sizes", "1100x700,1280x720,1440x900,1920x1080")
  .split(",")
  .map((s) => s.split("x").map(Number));
const steps = Number(opt("steps", "6"));
// Accept "cpu", "/cpu/" or a Git Bash-mangled "C:/Program Files/Git/cpu/".
const paths = args
  .filter((a) => !a.startsWith("--"))
  .map((a) => "/" + a.replace(/^.*\/Git\//, "").replace(/^\/+/, ""));
const pages = paths.length
  ? paths
  : [
      "/protocol/",
      "/cpu/",
      "/memory/",
      "/transaction/",
      "/transaction/deadlock.html",
      "/disk/",
      "/git/",
    ];
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  const out = [];
  if (document.documentElement.scrollHeight > innerHeight + 1) out.push("PAGE +" + (document.documentElement.scrollHeight - innerHeight));
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push("PAGE-X +" + (document.documentElement.scrollWidth - innerWidth));
  for (const e of document.querySelectorAll("body *")) {
    if (e.closest("dialog:not([open]), [hidden]")) continue;
    const c = getComputedStyle(e);
    const scrollY = /auto|scroll/.test(c.overflowY), scrollX = /auto|scroll/.test(c.overflowX);
    if (!scrollY && !scrollX) continue;
    const v = e.scrollHeight - e.clientHeight, h = e.scrollWidth - e.clientWidth;
    if ((scrollY && v > 2) || (scrollX && h > 2)) {
      const plate = e.closest(".hw-plate, [data-plate]");
      const where = plate ? (plate.dataset.plate ?? [...plate.classList].find((x) => /stage|side|deck|records|picker/.test(x)) ?? "plate") : "page";
      out.push(where + ":" + (e.id || [...e.classList].slice(0, 2).join(".") || e.tagName.toLowerCase()) + (scrollY && v > 2 ? " +" + v : "") + (scrollX && h > 2 ? " x+" + h : ""));
    }
  }
  return out.join(" | ") || "ok";
})()`;
const NEXT = `(() => { const k = document.querySelector('[data-action="next"], [data-action="step"], [data-action="event"]'); if (k && !k.disabled) { k.click(); return true; } return false; })()`;

const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(tmpdir(), "check-scroll-" + port)}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let ws, opened;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const p = list.find((t) => t.type === "page");
    if (p) {
      ws = new WebSocket(p.webSocketDebuggerUrl);
      opened = new Promise((r) => ws.addEventListener("open", r));
      break;
    }
  } catch {
    /* Chrome is still starting */
  }
  await sleep(200);
}
await opened;
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

let failures = 0;
for (const [w, h] of sizes) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const path of pages) {
    await send("Page.navigate", { url: base + path });
    await sleep(3200);
    const start = await evaluate(PROBE);
    for (let s = 0; s < steps; s++) {
      await evaluate(NEXT);
      await sleep(900);
    }
    const later = await evaluate(PROBE);
    const line =
      start === "ok" && later === "ok"
        ? "ok"
        : `start: ${start}  ||  after ${steps} steps: ${later}`;
    if (line !== "ok") failures++;
    console.log(`${w}x${h}  ${path.padEnd(28)} ${line}`);
  }
}
ws.close();
chrome.kill();
process.exitCode = failures ? 1 : 0;
