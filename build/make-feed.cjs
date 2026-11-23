// Writes release/latest.json next to the new setup exe, for the auto-updater.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const pkg = require("../package.json");
const name = `Moony-Setup-${pkg.version}.exe`;
const file = path.join(__dirname, "..", "release", name);
const buf = fs.readFileSync(file);
const base = pkg.moony.updateUrl.replace(/latest\.json$/, "").replace("/latest/download/", `/download/v${pkg.version}/`);
const feed = { version: pkg.version, url: base + name, sha256: crypto.createHash("sha256").update(buf).digest("hex"), size: buf.length, notes: process.env.NOTES || "" };
fs.writeFileSync(path.join(__dirname, "..", "release", "latest.json"), JSON.stringify(feed, null, 2));
console.log("release/latest.json ->", feed.url);
