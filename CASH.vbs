' Starts CASH with no console window. This is what the desktop icon points at.
' Start-CASH.bat still works if you want to watch it start or see an error.
Option Explicit

Dim sh, fso, here, bat
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
bat = here & "\Start-CASH.bat"

If Not fso.FileExists(bat) Then
  MsgBox "Start-CASH.bat is missing from:" & vbCrLf & here, 16, "CASH"
  WScript.Quit 1
End If

sh.CurrentDirectory = here
' 0 = hidden window, False = do not wait. Vite opens the browser itself once
' the server is listening, so there is nothing to time here.
sh.Run """" & bat & """", 0, False
