// Rust build: if Moony fails to start, write the error to moony.log and show
// it on the loading screen (instead of an endless "Loading Moony…").
(function () {
  var t = window.__TAURI_INTERNALS__; if (!t) return;
  var log = function (m) {
    m = String(m).slice(0, 2000);
    try { t.invoke("ipc", { channel: "log", args: [m] }); } catch (e) {}
    try { var el = document.querySelector("#root span") || document.body; var p = document.createElement("pre"); p.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;max-height:45vh;overflow:auto;white-space:pre-wrap;font:12px Consolas,monospace;color:#ff9aa6;background:#1a0f14;padding:10px;border-radius:8px;z-index:99999"; p.textContent = m; document.body.appendChild(p); } catch (e) {}
  };
  window.addEventListener("error", function (e) { log("error: " + e.message + " @ " + e.filename + ":" + e.lineno + (e.error && e.error.stack ? "\n" + e.error.stack : "")); }, true);
  window.addEventListener("unhandledrejection", function (e) { log("rejection: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
})();
