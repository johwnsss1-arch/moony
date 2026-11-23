; Moony installer: custom wording on the welcome and finish pages.
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Moony"
  !define MUI_WELCOMEPAGE_TEXT "Moony is a launcher for Roblox: faster launches, your playtime, friends, servers, mods and an in-game HUD.$\r$\n$\r$\nSetup will install Moony on this PC. Click Next to continue."
  !define MUI_FINISHPAGE_TITLE "Moony is ready"
  !define MUI_FINISHPAGE_TEXT "Moony has been installed. Sign in with Roblox inside Moony to get started."
!macroend

; Moony never touches your Roblox install on uninstall; mods it applied are
; undone by Roblox's next update. Your settings stay in %APPDATA%\Moony.
!macro customUnInstall
  DetailPrint "Removing Moony (your settings in %APPDATA%\Moony are kept)."
!macroend
