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
```

## Development Workflow

1. **Make changes** to the source code
2. **Test locally** with `npm start`
3. **Build for testing** with `npm run build:win` (or appropriate platform)
4. **Test the built application** from the `dist/` directory
5. **Commit changes** to source control

## Troubleshooting

### Build Issues

- **Linux build fails on Windows**: This is expected. Linux builds must be done on a Linux system
- **Missing dependencies**: Run `npm install` to ensure all dependencies are installed
- **Build cache issues**: Delete `node_modules` and `dist` directories, then run `npm install` again

### Runtime Issues

- **Application won't start**: Check that all dependencies are installed and Node.js version is compatible
- **Configuration not saving**: Ensure the application has write permissions to its data directory
- **Window positioning issues**: The application stores window state in local storage, try clearing browser data if needed 