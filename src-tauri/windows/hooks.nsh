; Moony 2 replaces Moony 1.x (the Electron version, installed in
; %LOCALAPPDATA%\Programs\Moony): remove its files, shortcuts and uninstall
; entry so there's only one Moony. Settings and Roblox are not touched.
!macro NSIS_HOOK_PREINSTALL
  IfFileExists "$LOCALAPPDATA\Programs\Moony\Moony.exe" 0 moony_no_old
    nsExec::Exec 'cmd /c timeout /t 2 /nobreak >nul'
    RMDir /r "$LOCALAPPDATA\Programs\Moony"
    Delete "$DESKTOP\Moony.lnk"
    Delete "$SMPROGRAMS\Moony.lnk"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Moony"
  moony_no_old:
!macroend
