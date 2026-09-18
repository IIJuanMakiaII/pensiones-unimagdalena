@echo off
chcp 65001 >nul
title Pensiones Unimagdalena - Servidor local (produccion)
cd /d "%~dp0"

if not exist package.json (
  echo.
  echo [ERROR] No se encontro package.json en:
  echo         %CD%
  echo         Coloca este archivo .bat dentro de la carpeta del proyecto.
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo   PENSIONES UNIMAGDALENA - Iniciando aplicacion
echo   Carpeta: %CD%
echo ============================================================
echo.

rem ------------------------------------------------------------------
rem [1/3] Libera el puerto 3000: evita el error de "chunks" causado por
rem tener dos servidores (o un servidor viejo) sobre la misma carpeta.
rem ------------------------------------------------------------------
echo [1/3] Liberando el puerto 3000 si hay un servidor anterior...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP.*:3000 .*LISTENING"') do (
  echo       deteniendo proceso PID %%p
  taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 >nul

rem ------------------------------------------------------------------
rem [2/3] Compila. Nunca mezclar "npm run dev" con "npm run build":
rem ese cruce es lo que corrompe la cache .next.
rem ------------------------------------------------------------------
echo [2/3] Compilando la aplicacion (puede tardar 1-2 minutos)...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] La compilacion fallo. Revisa los mensajes de arriba.
  echo         Sugerencia: elimina la carpeta .next y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

echo.
echo [3/3] Servidor en http://localhost:3000
echo       Deja esta ventana abierta. Para detener el servidor: Ctrl+C
echo.
start "" http://localhost:3000
call npm start

echo.
echo Servidor detenido.
pause
