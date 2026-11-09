// Headless Chrome over CDP: set the design system in localStorage, open a route, capture 1440x900 PNG + innerText.
// usage: node capture.mjs <port> <ds> <slug> <outBase> [width] [height] [prep-js]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [port, ds, slug, outBase, W = "1440", H = "900", prep = ""] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dbg = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [`--remote-debugging-port=${dbg}`, "--headless=new", "--hide-scrollbars", `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", `--user-data-dir=/tmp/cap-profile-${dbg}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver;
for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${dbg}/json/version`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.error) console.error("CDP error", JSON.stringify(m.error)); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const ev = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: +W, height: +H, deviceScaleFactor: 1, mobile: false }, sessionId);
const base = `http://127.0.0.1:${port}/moodle-escape-plan/`;
const isFile = slug.startsWith("file://");
if (!isFile) {
  await send("Page.navigate", { url: base + "blank-for-storage" }, sessionId);
  await sleep(600);
  await ev(`localStorage.setItem('demo.designSystem.v2', ${JSON.stringify(ds)}); sessionStorage.clear();`);
}
await send("Page.navigate", { url: isFile ? slug : base + slug }, sessionId);
await sleep(1800);
await ev(`document.fonts.ready`);
// hide the demo launcher, park the cursor away from the sidebar
await ev(`(()=>{const s=document.createElement('style');s.textContent='.demo-launcher{display:none!important}';document.head.appendChild(s);})()`);
if (prep) { await ev(prep); await sleep(700); }
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1430, y: 880 }, sessionId);
await sleep(300);
const txt = await ev(`document.body.innerText`);
writeFileSync(outBase + ".txt", txt.result.value || "");
const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
writeFileSync(outBase + ".png", Buffer.from(shot.result.data, "base64"));
ws.close(); chrome.kill();
console.log("wrote", outBase + ".png");
