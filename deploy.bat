@echo off
echo ========================================
echo   VERCEL DEPLOYMENT SCRIPT
echo ========================================
echo.

echo [1/5] Checking Vercel CLI...
where vercel >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Vercel CLI not found. Installing...
    npm install -g vercel
) else (
    echo Vercel CLI found!
)
echo.

echo [2/5] Building frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd ..
echo Frontend build completed!
echo.

echo [3/5] Checking backend dependencies...
cd backend
call npm install
cd ..
echo Backend dependencies installed!
echo.

echo [4/5] Deploying to Vercel...
echo.
echo IMPORTANT: Make sure you have configured these environment variables on Vercel Dashboard:
echo   - DATABASE_URL (PostgreSQL connection string)
echo   - JWT_SECRET
echo   - GOOGLE_CLIENT_ID (optional)
echo   - GOOGLE_CLIENT_SECRET (optional)
echo.
pause

vercel --prod

echo.
echo [5/5] Deployment completed!
echo.
echo Next steps:
echo 1. Configure environment variables on Vercel Dashboard if not done yet
echo 2. Run database migrations: cd backend ^&^& npx prisma migrate deploy
echo 3. Test your deployment at the URL provided by Vercel
echo.
pause
