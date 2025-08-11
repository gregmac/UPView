#!/bin/bash

# UPView Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "src/package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Get the version type (patch, minor, major)
VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Version type must be patch, minor, or major"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

print_status "Starting release process for version type: $VERSION_TYPE"

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "There are uncommitted changes. Please commit or stash them before releasing."
    git status --short
    exit 1
fi

# Navigate to src directory and bump version
cd src
print_status "Bumping version in package.json..."
npm version $VERSION_TYPE --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
print_status "New version: $NEW_VERSION"

# Go back to root and create git tag
cd ..
print_status "Creating git tag: v$NEW_VERSION"
git add src/package.json
git commit -m "Bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

print_status "Pushing changes and tag..."
git push origin main
git push origin "v$NEW_VERSION"

print_status "Release process completed!"
print_status "GitHub Actions will now build and release v$NEW_VERSION"
print_status "Check the Actions tab for build progress: https://github.com/gregmac/UPView/actions" 