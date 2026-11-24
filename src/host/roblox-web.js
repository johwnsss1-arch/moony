// Runs Moony's Roblox API client (electron/roblox.cjs, the same file the
// Electron build uses) inside the page, with every request going through
// Rust. Signed-in calls pass "moony:acct:<id>" instead of a cookie; Rust puts
// the real cookie in and never sends it back.
import create from "virtual:roblox-cjs";
import { invoke } from "@tauri-apps/api/core";

const b64ToBytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const bytesToB64 = (u) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

async function rustFetch(url, opts = {}) {
  const headers = {};
  const h = opts.headers instanceof Headers ? Object.fromEntries(opts.headers) : opts.headers || {};
  for (const [k, v] of Object.entries(h)) if (v != null) headers[k] = String(v);
  const req = { url: String(url), method: opts.method || "GET", headers };
  if (typeof opts.body === "string") req.body = opts.body;
  else if (opts.body instanceof Uint8Array || opts.body instanceof ArrayBuffer) req.bodyB64 = bytesToB64(new Uint8Array(opts.body));
  const r = await invoke("ipc", { channel: "http", args: [req] });
  const body = r.status === 204 || r.status === 304 ? null : r.b64 != null ? b64ToBytes(r.b64) : r.text;
  return new Response(body, { status: r.status, headers: r.headers });
}

// The small bits of Node the client uses.
const nodeCrypto = { randomUUID: () => crypto.randomUUID() };
const BufferShim = { from: (ab) => { const u = new Uint8Array(ab); return { toString: () => bytesToB64(u) }; } };

export const roblox = create((n) => (n === "crypto" ? nodeCrypto : {}), rustFetch, BufferShim);
export { rustFetch };
