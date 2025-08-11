# UnifiProtectLiveView-e

A dedicated desktop application for viewing Unifi Protect camera feeds with enhanced features and automation.

## Features

### Core Functionality

- **Dedicated Window**: Opens the Unifi Protect dashboard in a dedicated Electron browser window
- **Supports H.265 video**: High Efficiency Video Coding supported by Chromium
- **Automatic Login**: Automatically logs into your Unifi Protect system using stored credentials
- **Smart Navigation**: Automatically returns to the main dashboard view after a configurable idle timeout
- **Window State Persistence**: Remembers window size, position, and state between sessions

## Development

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd UnifiProtectLiveView-e
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

### Development Notes
- The application runs in development mode with DevTools enabled by default
- Configuration is stored locally and persists between sessions
- Use the Configuration menu item to set up your Unifi Protect instance URL and credentials
- The application automatically handles window positioning and state management

## License

GPL-3.0-only - See LICENSE file for details.

## Author

gregmac 