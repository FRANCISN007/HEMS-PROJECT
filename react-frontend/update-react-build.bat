@echo off
setlocal

:: =====================================================
::  Hotel & Event Management App Updater
:: =====================================================

:: === CONFIG ===
set PROJECT_DIR=C:\Users\KLOUNGE\Documents\HEMS-PROJECT\react-frontend
set TARGET_DIR=C:\Program Files\Hotel and Event Management App\react-frontend\build
set POWERSHELL_EXE=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe

echo "=== Hotel & Event Management App Updater ==="

:: === STEP 1: Build React with PowerShell (safe path) ===
echo Building React frontend with PowerShell...
"%POWERSHELL_EXE%" -ExecutionPolicy Bypass -NoProfile -Command ^
    "cd '%PROJECT_DIR%'; npm install; npm run build"

if errorlevel 1 (
    echo [ERROR] Build failed. Aborting update.
    pause
    exit /b 1
)

:: === STEP 2: Remove old target build ===
if exist "%TARGET_DIR%" (
    echo Removing old build at %TARGET_DIR%...
    rmdir /s /q "%TARGET_DIR%"
)

:: === STEP 3: Copy new build ===
echo Copying new build...
xcopy /E /I /Y "%PROJECT_DIR%\build" "%TARGET_DIR%"

if errorlevel 1 (
    echo [ERROR] Copy failed!
    pause
    exit /b 1
)

echo [OK] Update complete! Build successfully copied.
pause
