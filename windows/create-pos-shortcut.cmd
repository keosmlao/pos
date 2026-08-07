@echo off
REM ===================================================================
REM  ສ້າງ shortcut "SMLAO POS" ເທິງ Desktop — ບໍ່ຕ້ອງຕິດຕັ້ງ, ບໍ່ຕ້ອງ build
REM
REM  ໃຊ້ Edge/Chrome ທີ່ມີໃນເຄື່ອງເປີດແບບ --app= (ບໍ່ມີແຖບ browser,
REM  ບໍ່ມີ address bar — ຄືແອັບແທ້) + --kiosk-printing (ພິມບິນບໍ່ຖາມ)
REM
REM  ວິທີໃຊ້: double-click ໄຟລ໌ນີ້ ແລ້ວປ້ອນ URL ຂອງ server
REM ===================================================================
setlocal EnableDelayedExpansion

set "DEFAULT_URL=http://10.0.20.180:3000"
set /p "POSURL=URL ຂອງ server POS [%DEFAULT_URL%]: "
if "%POSURL%"=="" set "POSURL=%DEFAULT_URL%"

REM ຫາ browser: Edge ກ່ອນ (ມີໃນ Windows ທຸກເຄື່ອງ) ແລ້ວຄ່ອຍ Chrome
set "BROWSER="
for %%P in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) do if not defined BROWSER if exist %%P set "BROWSER=%%~P"

if not defined BROWSER (
  echo [X] ບໍ່ພົບ Microsoft Edge ຫຼື Google Chrome ໃນເຄື່ອງນີ້
  pause
  exit /b 1
)

REM ໂປຣໄຟລ໌ແຍກ: ບໍ່ໃຫ້ປົນກັບ browser ທີ່ພະນັກງານໃຊ້ທົ່ວໄປ
REM ແລະ ເຮັດໃຫ້ສິດ printer / serial (ລີ້ນຊັກ) ຄ້າງຢູ່ຖາວອນ
set "POSPROFILE=%LOCALAPPDATA%\SMLAO-POS-Profile"
set "ARGS=--app=%POSURL% --kiosk-printing --user-data-dir=""%POSPROFILE%"" --no-first-run --disable-features=Translate"

set "LNK=%USERPROFILE%\Desktop\SMLAO POS.lnk"
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');" ^
  "$s.TargetPath='%BROWSER%';" ^
  "$s.Arguments='%ARGS%';" ^
  "$s.IconLocation='%BROWSER%,0';" ^
  "$s.Description='SMLAO POS';" ^
  "$s.Save()"

if errorlevel 1 (
  echo [X] ສ້າງ shortcut ບໍ່ສຳເລັດ
  pause
  exit /b 1
)

echo.
echo ສຳເລັດ! ມີ icon "SMLAO POS" ຢູ່ Desktop ແລ້ວ
echo   Browser : %BROWSER%
echo   Server  : %POSURL%
echo.
echo ຄັ້ງທຳອິດທີ່ເປີດ: ຕັ້ງ printer ບິນເປັນ "printer ຄ່າເລີ່ມຕົ້ນ" ຂອງ Windows
echo ກ່ອນ ເພາະໂໝດພິມບໍ່ຖາມຈະສົ່ງໄປ printer ຄ່າເລີ່ມຕົ້ນສະເໝີ
echo.
pause
