@echo off
cd /d "%~dp0"
echo MindMATE AI+ PHP server
echo.
echo Hap app-in ketu:
echo http://127.0.0.1:8000/login.html
echo.
echo Mos e mbyll kete dritare sa je duke perdorur app-in.
echo.
C:\xampp\php\php.exe -S 127.0.0.1:8000 -t "%~dp0"
pause
