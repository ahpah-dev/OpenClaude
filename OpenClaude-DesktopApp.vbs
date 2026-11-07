Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
AppDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = AppDir

' Ensure environment daemons (9Router + Ollama) are started silently
WshShell.Run "cmd /c node server/cli-setup.js", 0, True

' Start OpenClaude server in background if port 3099 is not yet active
WshShell.Run "cmd /c netstat -ano | findstr :3099 | findstr LISTENING >nul || start /b node server/index.js", 0, True
WScript.Sleep 1200

' Launch native chromeless Desktop App window (Edge App Mode with fallback to default browser)
On Error Resume Next
WshShell.Run "msedge --app=http://localhost:3099 --window-size=1440,920", 1, False
If Err.Number <> 0 Then
    WshShell.Run "http://localhost:3099", 1, False
End If
