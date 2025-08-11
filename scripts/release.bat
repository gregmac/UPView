@echo off
setlocal enabledelayedexpansion

REM UPView Release Script for Windows
REM Usage: scripts\release.bat [patch|minor|major]

set VERSION_TYPE=%1
if "%VERSION_TYPE%"=="" set VERSION_TYPE=patch

echo [INFO] Starting release process for version type: %VERSION_TYPE%

REM Check if we're in the right directory
if not exist "src\package.json" (
    echo [ERROR] This script must be run from the project root directory
    exit /b 1
)

REM Check if there are uncommitted changes
git status --porcelain >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] There are uncommitted changes. Please commit or stash them before releasing.
    git status --short
    exit /b 1
)

REM Navigate to src directory and bump version
cd src
echo [INFO] Bumping version in package.json...
call npm version %VERSION_TYPE% --no-git-tag-version

REM Get the new version
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set NEW_VERSION=%%i
echo [INFO] New version: %NEW_VERSION%

REM Go back to root and create git tag
cd ..
echo [INFO] Creating git tag: v%NEW_VERSION%
git add src/package.json
git commit -m "Bump version to %NEW_VERSION%"
git tag "v%NEW_VERSION%"

echo [INFO] Pushing changes and tag...
git push origin main
git push origin "v%NEW_VERSION%"

echo [INFO] Release process completed!
echo [INFO] GitHub Actions will now build and release v%NEW_VERSION%
echo [INFO] Check the Actions tab for build progress: https://github.com/gregmac/UPView/actions 