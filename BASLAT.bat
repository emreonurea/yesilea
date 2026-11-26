@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   Yesilea - Baslat
echo ================================================
echo.

rem --- Bilgisayarin yerel IP adresi ---
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|VirtualBox|VMware' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"`) do set IP=%%i
echo Bilgisayarin adresi: %IP%
echo.

rem --- Sunucu zaten calisiyorsa ikinciyi acma ---
netstat -ano | findstr ":8787" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Sunucu ayri bir pencerede baslatiliyor. O pencereyi KAPATMAYIN.
  echo Windows Guvenlik Duvari soru sorarsa "Erisime izin ver" deyin.
  start "Yesilea - Sunucu" cmd /k "cd /d %~dp0 && npm run server"
  timeout /t 5 >nul
) else (
  echo Sunucu zaten calisiyor.
)
echo.

cd apps\mobile
echo EXPO_PUBLIC_API_URL=http://%IP%:8787> .env
set EXPO_PUBLIC_API_URL=http://%IP%:8787

rem --- Expo hesabi girisi (iPhone'da Expo Go icin gerekli) ---
call npx expo whoami >nul 2>nul
if errorlevel 1 (
  echo ------------------------------------------------
  echo  Expo hesabinizla giris yapin.
  echo  Hesabiniz yoksa once telefonda expo.dev/signup adresinden ucretsiz acin.
  echo  Sifre yazarken ekranda gorunmez, bu normaldir. Yazip Enter'a basin.
  echo ------------------------------------------------
  call npx expo login
  if errorlevel 1 (
    echo Giris yapilamadi. BASLAT.bat dosyasina tekrar cift tiklayip deneyin.
    pause
    exit /b
  )
) else (
  echo Expo hesabiyla giris yapilmis.
)
echo.
echo Birazdan bir QR kod cikacak. Telefonun Kamera uygulamasiyla okutun.
echo (Telefonda Expo Go'da da AYNI hesapla giris yapmis olun.)
echo.
call npx expo start --lan
pause
