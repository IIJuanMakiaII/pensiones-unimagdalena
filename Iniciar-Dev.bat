@echo off
chcp 65001 >nul
title Pensiones Unimagdalena - Modo desarrollo (recarga automatica)
cd /d "%~dp0"

if not exist package.json (
  echo.
  echo [ERROR] No se encontro package.json en:
  echo         %CD%
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo   PENSIONES UNIMAGDALENA - Modo desarrollo
echo   Los cambios en el codigo se recargan solos en el navegador
echo ============================================================
echo.
echo  IMPORTANTE: mientras este servidor este abierto NO ejecutes
echo  "npm run build" ni "npm start" en otra ventana: mezclar ambos
echo  modos corrompe la cache .next y el navegador mostrara errores
echo  de tipos "Cannot read properties of undefined (reading 'call')".
echo  Si necesitas la version de produccion, usa Iniciar-App.bat.
echo.

echo Liberando el puerto 3000 si hay un servidor anterior...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP.*:3000 .*LISTENING"') do (
  echo    deteniendo proceso PID %%p
  taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 >nul

echo.
echo Servidor de desarrollo en http://localhost:3000
echo Para detenerlo: Ctrl+C
echo.
start "" http://localhost:3000
call npm run dev

echo.
echo Servidor detenido.
pause
