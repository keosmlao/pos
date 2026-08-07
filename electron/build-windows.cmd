@echo off
REM ===================================================================
REM  Build ໂຕຕິດຕັ້ງ SMLAO POS (.exe) — ແລ່ນໃນເຄື່ອງ Windows ເທົ່ານັ້ນ
REM  ວິທີໃຊ້: double-click ໄຟລ໌ນີ້ (ຫຼືພິມ build-windows.cmd ໃນ cmd)
REM  ຕ້ອງມີ Node.js LTS ກ່ອນ: https://nodejs.org
REM ===================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] ບໍ່ພົບ Node.js — ຕິດຕັ້ງກ່ອນທີ່ https://nodejs.org ແລ້ວແລ່ນໃໝ່
  pause
  exit /b 1
)

echo [1/3] ຕິດຕັ້ງ dependencies...
call npm install
if errorlevel 1 goto fail

echo [2/3] Build NSIS installer (x64)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win nsis --x64
if errorlevel 1 goto fail

echo [3/3] ປ່ຽນຊື່ເປັນ SMLAO-POS-Setup.exe...
if not exist "out" mkdir "out"
REM ເອົາ .exe ໜ່ວຍໃໝ່ສຸດໃນ dist (ອາດມີໄຟລ໌ເກົ່າຄ້າງຢູ່)
set "SETUP="
for /f "delims=" %%F in ('dir /b /a-d /o-d "dist\*.exe" 2^>nul') do if not defined SETUP set "SETUP=%%F"
if not defined SETUP (
  echo [X] ບໍ່ພົບໄຟລ໌ .exe ໃນໂຟນເດີ dist
  goto fail
)
copy /y "dist\%SETUP%" "out\SMLAO-POS-Setup.exe" >nul
if errorlevel 1 goto fail

echo.
echo ສຳເລັດ! ໄຟລ໌ຢູ່ທີ່: %cd%\out\SMLAO-POS-Setup.exe
echo ເອົາໄຟລ໌ນີ້ໄປວາງທີ່ public\downloads\ ຂອງ server ເພື່ອໃຫ້ໜ້າ /admin/download ດາວໂຫຼດໄດ້
pause
exit /b 0

:fail
echo.
echo [X] Build ບໍ່ສຳເລັດ — ເບິ່ງຂໍ້ຄວາມ error ຂ້າງເທິງ
pause
exit /b 1
