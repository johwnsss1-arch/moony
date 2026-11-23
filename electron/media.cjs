// What's playing on the PC (Spotify, YouTube in a browser, etc.), read from
// Windows' media controls, the same info Windows shows in its volume pop-up.
const { spawn } = require("child_process");
const { EventEmitter } = require("events");

const MEDIA_PS = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(-1); $t.Result }
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
while ($true) {
  $s = $mgr.GetCurrentSession()
  if ($s) {
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $o = [ordered]@{ title = $p.Title; artist = $p.Artist; album = $p.AlbumTitle; app = $s.SourceAppUserModelId; status = [string]$s.GetPlaybackInfo().PlaybackStatus }
    Write-Output ($o | ConvertTo-Json -Compress)
  } else { Write-Output '{}' }
  Start-Sleep -Milliseconds 3000
}`;

// Friendly names for common players.
const APPS = [
  [/spotify/i, "Spotify"], [/chrome/i, "Chrome"], [/msedge|edge/i, "Edge"], [/firefox/i, "Firefox"], [/opera/i, "Opera"], [/brave/i, "Brave"],
  [/zunemusic|music\.ui|groove/i, "Media Player"], [/vlc/i, "VLC"], [/itunes|applemusic/i, "Apple Music"], [/discord/i, "Discord"],
  [/soundcloud/i, "SoundCloud"], [/tidal/i, "TIDAL"], [/deezer/i, "Deezer"], [/amazon/i, "Amazon Music"], [/youtube/i, "YouTube"],
];
const appName = (id = "") => APPS.find(([re]) => re.test(id))?.[1] || id.replace(/\.exe$/i, "").split(/[!._\\]/).filter(Boolean).pop() || "";

class Media extends EventEmitter {
  constructor() { super(); this.current = null; this.proc = null; }
  start() {
    if (this.proc) return;
    this.proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", MEDIA_PS], { windowsHide: true });
    let buf = "";
    this.proc.stdout.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      const last = lines.filter(Boolean).pop();
      if (!last) return;
      let m = null;
      try { m = JSON.parse(last); } catch { return; }
      const next = m.title ? { title: m.title, artist: m.artist || "", album: m.album || "", app: appName(m.app), playing: m.status === "Playing" } : null;
      if (JSON.stringify(next) !== JSON.stringify(this.current)) { this.current = next; this.emit("change", next); }
    });
    this.proc.on("exit", () => { this.proc = null; });
  }
  stop() { this.proc?.kill(); this.proc = null; if (this.current) { this.current = null; this.emit("change", null); } }
}

module.exports = { Media, appName };
