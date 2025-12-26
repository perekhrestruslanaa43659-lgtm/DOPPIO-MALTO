@echo off
echo ========================================
echo   FIX DATABASE - ScheduFlow
echo ========================================
echo.
echo Questo script applica lo schema al database.
echo.

cd backend

echo [1/2] Applicando schema al database...
call npx prisma db push --accept-data-loss

echo.
echo [2/2] Generando client Prisma...
call npx prisma generate

echo.
echo ========================================
echo   COMPLETATO!
echo ========================================
echo.
echo Ora riavvia il backend con: npm run dev
echo.
pause
