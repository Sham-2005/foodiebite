# FoodieBite Android Appium Environment Verification & Setup Script (PowerShell)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  FoodieBite Android Appium Environment Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
try {
    $nodeVer = node -v
    Write-Host "[OK] Node.js is installed: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Node.js is not installed or not in PATH." -ForegroundColor Red
}
try {
    $javaVer = java -version 2>&1 | Select-Object -First 1
    Write-Host "[OK] Java JDK is installed: $javaVer" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Java JDK is not installed. Please install OpenJDK 17." -ForegroundColor Red
}
if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    Write-Host "[OK] ANDROID_HOME is set: $env:ANDROID_HOME" -ForegroundColor Green
    $adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    if (Test-Path $adbPath) {
        Write-Host "[OK] adb executable found: $adbPath" -ForegroundColor Green
    } else {
        Write-Host "[WARN] adb executable missing in platform-tools." -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] ANDROID_HOME environment variable is not defined or directory missing." -ForegroundColor Yellow
}
try {
    $appiumVer = appium --version
    Write-Host "[OK] Appium CLI is installed globally: v$appiumVer" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Appium CLI is not installed globally. Install via: npm install -g appium" -ForegroundColor Yellow
}
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Android Environment Verification Complete!" -ForegroundColor Cyan
