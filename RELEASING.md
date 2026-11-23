# Shipping Moony to your friends

## First time
1. Make a free GitHub account and a **public** repository called `moony` (it can be empty).
2. In `package.json`, set `moony.updateUrl` to
   `https://github.com/<your-name>/moony/releases/latest/download/latest.json`
3. Install the GitHub CLI and sign in: `winget install GitHub.cli`, then `gh auth login`.

## Every release
1. Bump `"version"` in `package.json` (e.g. 1.0.0 → 1.0.1). Updates only go out when this goes up.
2. `npm run dist` → makes `release/Moony-Setup-<version>.exe` and `release/latest.json`.
3. Publish both:
   ```
   gh release create v1.0.1 release/Moony-Setup-1.0.1.exe release/latest.json --repo <your-name>/moony --title "Moony 1.0.1" --notes "What changed"
   ```

Every installed Moony checks `latest.json` at startup and every 6 hours, downloads the new
setup in the background, verifies its SHA-256, and shows "Restart to update". If they ignore it,
it installs itself the next time they quit Moony. Settings and sign-ins are kept.

To share with a friend, just send them `Moony-Setup-<version>.exe` (or the release link).
It installs for their user only, with no admin prompt. It's not code-signed, so Windows
SmartScreen shows "Windows protected your PC" → **More info → Run anyway**. Signing it needs
a paid code-signing certificate.

## Major updates: add a showcase video
For a big release, record the live showcase (dev server running: `npm run dev`):
```
ORIENT=landscape npx electron trailer/live-record.cjs     # trailer/out/moony-live-landscape.mp4
```
1. Copy it to `release/moony-showcase.mp4` and add it to the `gh release create` command.
2. In `src/lib/changelog.js`, give that version's entry a video so it plays in the What's New popup:
   `video: "https://github.com/<your-name>/moony/releases/download/vX.Y.Z/moony-showcase.mp4"`
3. Mention it in the release notes.

Other edits for TikTok (portrait):
```
EDIT=beforeafter AUDIO_START=13.4 ORIENT=portrait npx electron trailer/live-record.cjs
EDIT=themes      AUDIO_START=13   ORIENT=portrait npx electron trailer/live-record.cjs
```
Music and sound effects come from `node trailer/song2.cjs`.
