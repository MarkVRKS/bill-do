!macro customInstall
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "DisplayName" "Билл-до"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "UninstallString" "$\"$INSTDIR\Uninstall Билл-до.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "DisplayIcon" "$\"$INSTDIR\Билл-до.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "Publisher" "Билл-до"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "DisplayVersion" "2.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "URLInfoAbout" "https://bill-do.ru"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "NoModify" 1
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до" "NoRepair" 1
!macroend

!macro customUnInit
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билл-до"
!macroend
