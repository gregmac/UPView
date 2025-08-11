# Development Guide

This document contains development and build instructions for UPView.

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- For cross-platform builds, you'll need to build on each target platform

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd UPView
   ```

2. **Install dependencies**
   ```bash
   cd src
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

## Development Notes

- The application runs in development mode with DevTools enabled by default
- Configuration is stored locally and persists between sessions
- Use the Configuration menu item to set up your Unifi Protect instance URL and credentials
- The application automatically handles window positioning and state management

## Build

### Building Locally

The application uses electron-builder to create distributable packages for different platforms.

#### Build Commands

1. **Install dependencies** (if not already done)
   ```bash
   cd src
   npm install
   ```

2. **Build for current platform**
   ```bash
   npm run build
   ```

3. **Build for specific platforms**
   ```bash
   # Windows (creates .exe installer and portable)
   npm run build:win
   
   # macOS (creates .dmg installer)
   npm run build:mac
   
   # Linux (creates .AppImage)
   npm run build:linux
   ```

#### Build Outputs

Build artifacts are created in the `src/dist/` directory:

- **Windows**: 
  - `UPView Setup 0.1.0.exe` - NSIS installer
  - `UPView 0.1.0.exe` - Portable executable
  - `win-unpacked/` - Unpacked application directory

- **macOS**:
  - `UPView 0.1.0.dmg` - Disk image installer
  - `mac/` - Unpacked application directory

- **Linux**:
  - `UPView-0.1.0.AppImage` - AppImage package
  - `linux-unpacked/` - Unpacked application directory

#### Build Configuration

The build is configured in `src/package.json` with the following features:
- **App ID**: `com.gregmac.upview`
- **Product Name**: `UPView`
- **No Desktop Shortcuts**: Desktop shortcuts are disabled by default
- **Start Menu Shortcuts**: Enabled for Windows
- **Cross-platform Support**: Windows, macOS, and Linux targets

## GitHub Actions and Automated Releases

### Automated Build and Release

The project uses GitHub Actions to automatically build and release the application when tags are pushed.

#### Release Workflow

1. **Manual Release** (recommended):
   ```bash
   # Create and push a new version tag
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Automatic Versioning** (optional):
   - Push changes to the `main` branch
   - The version workflow will automatically:
     - Bump the patch version
     - Create a new tag
     - Trigger the release workflow

#### Release Scripts

For convenience, release scripts are provided:

**Linux/macOS:**
```bash
# Patch release (0.1.0 -> 0.1.1)
./scripts/release.sh patch

# Minor release (0.1.0 -> 0.2.0)
./scripts/release.sh minor

# Major release (0.1.0 -> 1.0.0)
./scripts/release.sh major
```

**Windows:**
```cmd
# Patch release (0.1.0 -> 0.1.1)
scripts\release.bat patch

# Minor release (0.1.0 -> 0.2.0)
scripts\release.bat minor

# Major release (0.1.0 -> 1.0.0)
scripts\release.bat major
```

The scripts will:
- Check for uncommitted changes
- Bump the version in `package.json`
- Create a git tag
- Push changes and tag to trigger GitHub Actions

#### Workflow Files

- **`.github/workflows/release.yml`**: Builds and releases on tag push
- **`.github/workflows/version.yml`**: Automatically bumps version on main branch push

#### Release Process

When a tag is pushed (e.g., `v1.0.1`):

1. **Parallel builds** run on Windows, macOS, and Linux
2. **Electron Builder** creates platform-specific installers
3. **GitHub Release** is created with all build artifacts
4. **Artifacts** are uploaded for each platform

#### Version Management

- **Manual**: Use `git tag v1.0.1` for specific versions
- **Automatic**: Push to main branch for automatic patch version bumps
- **Semantic Versioning**: Follows MAJOR.MINOR.PATCH format

### Publishing Configuration

The build is configured to publish to GitHub releases:
- **Provider**: GitHub
- **Owner**: gregmac
- **Repo**: UPView
- **Token**: Uses `GITHUB_TOKEN` (automatically provided)

## Project Structure

```
src/
├── index.js              # Main Electron process entry point
├── mainWindow.js         # Main window management and logic
├── configWindow.js       # Configuration window management
├── config.html           # Configuration UI
├── preload.js            # Preload script for security
├── package.json          # Dependencies and build configuration
└── dist/                 # Build output directory (gitignored)
scripts/
├── release.sh            # Release script for Linux/macOS
└── release.bat           # Release script for Windows
.github/
└── workflows/
    ├── release.yml       # Build and release workflow
    └── version.yml       # Automatic versioning workflow
```

## Development Workflow

1. **Make changes** to the source code
2. **Test locally** with `npm start`
3. **Build for testing** with `npm run build:win` (or appropriate platform)
4. **Test the built application** from the `dist/` directory
5. **Commit changes** to source control
6. **Create release** using the release script: `./scripts/release.sh patch`

## Troubleshooting

### Build Issues

- **Linux build fails on Windows**: This is expected. Linux builds must be done on a Linux system
- **Missing dependencies**: Run `npm install` to ensure all dependencies are installed
- **Build cache issues**: Delete `node_modules` and `dist` directories, then run `npm install` again

### GitHub Actions Issues

- **Permission denied**: Ensure the repository has the necessary permissions for GitHub Actions
- **Build failures**: Check the Actions tab for detailed error logs
- **Version conflicts**: Ensure version numbers are unique and follow semantic versioning

### Runtime Issues

- **Application won't start**: Check that all dependencies are installed and Node.js version is compatible
- **Configuration not saving**: Ensure the application has write permissions to its data directory
- **Window positioning issues**: The application stores window state in local storage, try clearing browser data if needed 