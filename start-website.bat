@echo off
title Panti Janda - Start Servers
echo ============================================
echo   Panti Janda - Starting Development Servers
echo ============================================
echo.

echo [1/2] Starting mock backend (port 8000)...
start "Mock Backend" cmd /k "npm run dev:function"

echo [2/2] Starting Vite dev server (port 5175)...
start "Vite Dev Server" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo   Mock Backend:  http://127.0.0.1:8000
echo   Vite Dev:      http://127.0.0.1:5175
echo.
echo Test accounts:
echo   admin@panti.local / admin123 (admin)
echo   user@panti.local  / user123  (user)
echo.
pause
