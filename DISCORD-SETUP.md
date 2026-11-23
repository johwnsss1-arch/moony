# Moony Discord server: ready-made setup

Takes about 10 minutes. Everything below can be copied straight into Discord.

## 1. Create the server
1. In Discord, click **+** (Add a Server) at the bottom of the server list → **Create My Own** → **For a club or community**.
2. Name: **Moony** · Icon: `orbit-launcher/build/icon.png`
3. Server Settings → **Enable Community** (gives you Rules, Announcements and a welcome screen).

## 2. Roles (Server Settings → Roles), top to bottom
| Role | Colour | Notes |
|---|---|---|
| Owner | `#8B7DFF` | Administrator |
| Moderator | `#FF6FA8` | Manage Messages, Timeout Members, Kick Members |
| Tester | `#3FD0FF` | Sees #beta-testing |
| Member | `#A4A6B3` | Given to everyone who accepts the rules |

## 3. Channels
**📢 INFO**
- `#welcome` (read-only)
- `#rules` (read-only)
- `#announcements` (Announcement channel, read-only): post every new release here
- `#download` (read-only)

**💬 COMMUNITY**
- `#general`
- `#screenshots` (show off your themes and HUD)
- `#looking-to-play`
- `🔊 Hangout` (voice)

**🌙 MOONY**
- `#support`, ideally a **Forum** channel with tags: *Install*, *Launching*, *HUD*, *Themes*, *Account*, *Solved*
- `#bug-reports` (Forum)
- `#suggestions` (Forum, with tags *Planned* / *Done* / *Not planned*)
- `#beta-testing` (only Tester and above)

## 4. Messages to paste

### #welcome
```
🌙 **Welcome to Moony!**

Moony is a free desktop launcher for Roblox, with its own bootstrapper, server regions, playtime tracking, friends, mods, an in-game HUD and illustrated themes.

⬇️ Website: https://moonylauncher.xyz
⬇️ Download: https://github.com/johwnsss1-arch/moony/releases/latest
📜 Read #rules, then say hi in #general!
🛠️ Need help? Post in #support.
💡 Got an idea? #suggestions
```

### #rules
```
**Moony server rules**

1. Be kind. No harassment, hate speech or targeting anyone.
2. Keep it safe for everyone: no NSFW, gore or shock content.
3. No spam, self-promo or unsolicited DMs.
4. Never share passwords, .ROBLOSECURITY cookies or account details, and never ask for them. Staff will NEVER DM you asking for them.
5. No exploits, cheats or anything that breaks Roblox's Terms of Use.
6. Use the right channel: help in #support, bugs in #bug-reports.
7. Follow Discord's Terms of Service and Community Guidelines.

Moony is a fan-made project and isn't affiliated with Roblox Corporation.
```

### #download
```
⬇️ **Get Moony**
https://github.com/johwnsss1-arch/moony/releases/latest

1. Download **Moony-Setup-x.x.x.exe**
2. If Windows says "Windows protected your PC" → **More info → Run anyway** (Moony isn't code-signed yet)
3. Click **Install**, then sign in with Roblox inside Moony

Moony updates itself automatically. You only ever install it once.
```

### Release announcement template (#announcements)
```
🌙 **Moony vX.X.X is out!**

✨ What's new
• …
• …

🐛 Fixes
• …

Moony will offer the update by itself ("Restart to update"), or grab it here:
https://github.com/johwnsss1-arch/moony/releases/latest
```

## 5. Safety settings (recommended)
- Server Settings → Safety Setup → **Verification level: Medium**, **DM spam filter on**, **AutoMod**: block mentions spam and enable "Block words" for `ROBLOSECURITY`, `cookie logger` and `free robux`.
- Onboarding: require accepting the rules before chatting, and give **Member** on accept.

## 6. Get the invite link
Right-click `#welcome` → **Invite People** → **Edit invite link** → *Expire after: Never*, *Max uses: No limit* → copy it (looks like `https://discord.gg/abc123`).

Send that link to Claude and it'll go into the Moony app's Discord button.
