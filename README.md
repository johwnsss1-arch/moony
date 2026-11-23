<p align="center"><img src="build/icon.png" width="96" alt="Moony" /></p>
<h1 align="center">Moony</h1>
<p align="center">A free, open-source Roblox launcher for Windows.<br/>Server regions, playtime tracking, an in-game HUD, mods and hand-drawn themes.</p>
<p align="center"><a href="https://github.com/johwnsss1-arch/moony/releases/latest"><b>Download</b></a> · <a href="https://johwnsss1-arch.github.io/moony/">Website</a> · <a href="https://discord.gg/wsphtTzsP">Discord</a></p>

---

## Features
- **Server regions**: see where a server is before joining.
- **Playtime tracking**: per game, per week, all time.
- **In-game HUD**: clock, session timer, region, music visualiser, "Made with Moony" tag.
- **Mods & tweaks**: FPS unlock, fonts, sounds. All reversible.
- **Friends & multiple accounts.**
- **11 themes** with their own art, frames, buttons and pets.
- **Auto-updates** verified with SHA-256.

## Safety
- You sign in on Roblox's own login page. Moony never sees your password.
- Your Roblox session is stored only on your PC, encrypted with Windows (Electron `safeStorage`).
- Moony doesn't inject into the game or provide any gameplay advantage.

Moony is a fan project and is not affiliated with Roblox Corporation.

## Building from source
```bash
npm install
npm run desktop     # run the app in development
npm run dist        # build the Windows installer into release/
```
Requires Node 20+ on Windows. See [RELEASING.md](RELEASING.md) for publishing updates.

## Project layout
| Path | What |
|---|---|
| `electron/` | Main process: launching Roblox, sessions, installer, updater, HUD overlay |
| `src/` | React UI (pages, components, themes) |
| `trailer/` | Trailer / TikTok edits, song generator and renderer |
| `website/` | The Moony website (GitHub Pages) |

## License
[MIT](LICENSE)
