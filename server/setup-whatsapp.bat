@echo off
cd /d "%~dp0"
echo.
echo  SOLAR GALAXY - WhatsApp API setup
echo  Nomer: +7 777 475 1332
echo.
echo  Otkroetsya Meta Developer Console v brauzere.
echo  Skopiruyte Token i Phone number ID iz WhatsApp - API Setup
echo.
start https://developers.facebook.com/apps/
node scripts/whatsapp-setup.mjs
pause
