<p align="center"><img src="brand/moony-icon.svg" width="96" alt="Moony" /></p>
<h1 align="center">moony</h1>
<p align="center">A free, open-source Roblox launcher for Windows.<br/>Pick the server you join, follow friends into games and boost performance while you play.</p>
<p align="center"><a href="https://github.com/johwnsss1-arch/moony/releases/latest"><b>Download</b></a> · <a href="https://moonylauncher.xyz">Website</a> · <a href="https://discord.gg/moonylauncher">Discord</a></p>

---

## Features
- **Fast join and server picking**: every open server with ping and player count, Fast join, Server hop and a ping chart.
- **Discover and Charts**: search Roblox, genre filters, hidden gems, and live most played and trending lists.
- **Friends and Party**: see what friends are playing and follow them into games.
- **Performance**: Boost mode while you play, FPS unlock and reversible tweaks.
- **Playtime and Wrapped**: per game, per week and all time.
- **In-game HUD**: clock, session timer, server region and more.
- **Your own background and interface scale.**
- **Auto-updates** verified with SHA-256.

## Safety
- You sign in on Roblox's own login page. Moony never sees your password.
- Your Roblox session is stored only on your PC, encrypted with Windows (DPAPI), and handled only by Moony's Rust core: the interface never sees it.
- Moony doesn't inject into the game or provide any gameplay advantage.

Moony is a fan project and is not affiliated with Roblox Corporation.

## Building from source
```bash
npm install
npm run dev                      # interface in the browser
npx tauri dev                    # the desktop app
```
Requires Node 20+ and Rust on Windows. `installer/build.ps1` builds the app and the setup.

## Project layout
| Path | What |
|---|---|
| `src-tauri/` | Rust core (Tauri): window, network, sessions, Roblox install and launch, HUD overlay, updater |
| `installer/` | Moony Setup: install, update and uninstall |
| `src/` | React interface |
| `brand/` | Logo and icons |

## License
[MIT](LICENSE)
