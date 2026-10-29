# FoodieBite Automator and Builder Script
# This script handles missing SDK components, sets up Java 17, installs dependencies, compiles the Android APK, and builds the React Native Web app.

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  FoodieBite Build and Environment Automator" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Install Dependencies
Write-Host "`n[1/6] Installing npm dependencies..." -ForegroundColor Yellow
npm install
Write-Host "npm dependencies installed successfully!" -ForegroundColor Green

# 2. Environment and Java Setup
Write-Host "`n[2/6] Configuring Java 17 Environment..." -ForegroundColor Yellow
$java17Path = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"

if (-not (Test-Path $java17Path)) {
    Write-Error "Java 17 not found at $java17Path. Please make sure Java 17 is installed."
}

$env:JAVA_HOME = $java17Path
$env:PATH = "$java17Path\bin;" + $env:PATH

Write-Host "JAVA_HOME set to: $env:JAVA_HOME" -ForegroundColor Green
java -version

# 3. Android SDK Setup
Write-Host "`n[3/6] Configuring Android SDK..." -ForegroundColor Yellow
$sdkDir = "C:\Users\LENOVO\AppData\Local\Android\Sdk"

if (-not (Test-Path $sdkDir)) {
    Write-Error "Android SDK not found at $sdkDir."
}

# Ensure local.properties is configured
$localPropertiesPath = "android\local.properties"
$sdkDirEscaped = $sdkDir -replace '\\', '\\\\'
"sdk.dir=$sdkDirEscaped" | Out-File -FilePath $localPropertiesPath -Encoding ascii -Force
Write-Host "Updated local.properties with sdk.dir=$sdkDir" -ForegroundColor Green

# 4. Download cmdline-tools if missing
$cmdlineToolsDir = Join-Path $sdkDir "cmdline-tools"
$sdkmanagerPath = Join-Path $cmdlineToolsDir "latest\bin\sdkmanager.bat"

if (-not (Test-Path $sdkmanagerPath)) {
    Write-Host "Android Command-line Tools (sdkmanager) not found at: $sdkmanagerPath" -ForegroundColor Yellow
    Write-Host "Downloading Command-line Tools..." -ForegroundColor Yellow
    
    $zipUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $zipPath = Join-Path $env:TEMP "commandlinetools.zip"
    $extractPath = Join-Path $env:TEMP "commandlinetools_extracted"
    
    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force
    }
    
    # Download zip file
    Write-Host "Downloading from $zipUrl ..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    
    # Extract zip file
    Write-Host "Extracting Command-line Tools..."
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    # Move extracted files to SDK location under cmdline-tools/latest
    $latestPath = Join-Path $cmdlineToolsDir "latest"
    if (-not (Test-Path $latestPath)) {
        New-Item -ItemType Directory -Path $latestPath -Force | Out-Null
    }
    
    Write-Host "Installing to $latestPath ..."
    Copy-Item -Path (Join-Path $extractPath "cmdline-tools\*") -Destination $latestPath -Recurse -Force
    
    # Clean up temp files
    Remove-Item -Path $zipPath -Force
    Remove-Item -Path $extractPath -Recurse -Force
    
    Write-Host "Command-line Tools installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Android Command-line Tools already exists." -ForegroundColor Green
}

# 5. Install Platforms and Build-tools
Write-Host "`n[4/6] Checking and Installing Android SDK Platform 34..." -ForegroundColor Yellow
$platform34Path = Join-Path $sdkDir "platforms\android-34"

# Accept licenses first
Write-Host "Accepting licenses..."
cmd.exe /c "echo y | `"$sdkmanagerPath`" --licenses"

# Install platform 34 and build tools 34.0.0
Write-Host "Installing platforms;android-34 and build-tools;34.0.0..."
& "$sdkmanagerPath" --verbose "platforms;android-34" "build-tools;34.0.0"

Write-Host "Android SDK Platform 34 and Build Tools 34.0.0 checked/installed successfully!" -ForegroundColor Green

# 6. Build Android App
Write-Host "`n[5/6] Building Android App..." -ForegroundColor Yellow
cd android
Write-Host "Running gradlew clean..."
.\gradlew clean

Write-Host "Running gradlew assembleDebug..."
.\gradlew assembleDebug
cd ..

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "Android APK compiled successfully! Path: $apkPath" -ForegroundColor Green
} else {
    Write-Error "Android build completed but APK was not found at $apkPath"
}

# 7. Build Web App
Write-Host "`n[6/6] Building Web App..." -ForegroundColor Yellow
npm run build
Write-Host "Web app compiled successfully!" -ForegroundColor Green

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "  All fixes and builds completed successfully!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
