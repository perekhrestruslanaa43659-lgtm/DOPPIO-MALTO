@echo off
echo ==========================================
echo   SCHEDUFLOW - DEVELOPMENT MODE (LOCALE)
echo ==========================================
echo.
echo 1. Starting Backend Server (Port 4000)...
start "ScheduFlow Backend" cmd /k "cd backend && npm start"

echo 2. Starting Frontend (Port 5173)...
start "ScheduFlow Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==========================================
echo   APP AVVIATA IN LOCALE!
echo   Apri il browser su: http://localhost:5173
echo ==========================================
pause
