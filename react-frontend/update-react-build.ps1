# Paths
$ProjectBuild = "C:\Users\KLOUNGE\Documents\HEMS-PROJECT\react-frontend\build"
$TargetDir    = "C:\Program Files\Hotel and Event Management App\react-frontend\build"

Write-Host "=== Hotel & Event Management App Updater ===" -ForegroundColor Cyan

# Check if source build exists
if (-Not (Test-Path $ProjectBuild)) {
    Write-Host "[ERROR] Build folder not found at $ProjectBuild" -ForegroundColor Red
    exit 1
}

# Remove old target build
if (Test-Path $TargetDir) {
    Write-Host "Removing old build at $TargetDir..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $TargetDir
}

# Copy new build
Write-Host "Copying new build..." -ForegroundColor Yellow
Copy-Item -Recurse -Force $ProjectBuild $TargetDir

Write-Host "[OK] Update complete! Build successfully copied." -ForegroundColor Green
#pause
