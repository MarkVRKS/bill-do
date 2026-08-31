!macro customInstall
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "DisplayName" "Билдо"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "UninstallString" "$\"$INSTDIR\Uninstall Билдо.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "DisplayIcon" "$\"$INSTDIR\Билдо.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "Publisher" "Билдо"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "DisplayVersion" "1.2.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "URLInfoAbout" "https://billdo.ru"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "NoModify" 1
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо" "NoRepair" 1
!macroend

!macro customUnInit
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Билдо"
!macroend
