@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   Yesilea - Kurulum
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. Simdi kuruluyor, Windows izin sorarsa "Evet" deyin...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Node.js kuruldu. Bu pencereyi kapatip KUR.bat dosyasina TEKRAR cift tiklayin.
  pause
  exit /b
)
echo Node.js surumu:
node -v
echo.
echo [1/3] Paketler indiriliyor, birkac dakika surebilir...
call npm install
if errorlevel 1 goto hata
echo.
echo [2/3] Telefon uygulamasi Expo Go'nun guncel surumune uyarlaniyor...
cd apps\mobile
call npx expo install expo@latest
if errorlevel 1 goto hata
call npx expo install --fix
cd ..\..
echo.
echo [3/3] Ayar dosyalari hazirlaniyor...
if not exist apps\server\.env copy apps\server\.env.example apps\server\.env >nul
if not exist apps\mobile\.env copy apps\mobile\.env.example apps\mobile\.env >nul
echo.
echo ================================================
echo   Kurulum bitti. Simdi BASLAT.bat dosyasina cift tiklayin.
echo ================================================
pause
exit /b

:hata
echo.
echo Bir hata olustu. Bu pencerenin ekran goruntusunu Claude'a gonderin.
pause
