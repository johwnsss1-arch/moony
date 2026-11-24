
      // Rust build: send start-up errors to Moony's log file (moony.log).
      (function () {
        var t = window.__TAURI_INTERNALS__; if (!t) return;
        var log = function (m) { try { t.invoke("ipc", { channel: "log", args: [String(m).slice(0, 2000)] }); } catch (e) {} };
        window.addEventListener("error", function (e) { log("error: " + e.message + " @ " + e.filename + ":" + e.lineno + (e.error && e.error.stack ? "
" + e.error.stack : "")); });
        window.addEventListener("unhandledrejection", function (e) { log("rejection: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
      })();
    