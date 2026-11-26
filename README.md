# Kiro Account Switcher for VS Code

<p align="center">
  <img src="media/icon-128.svg" alt="Kiro Account Switcher Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Save, monitor quota, and seamlessly switch between multiple Kiro accounts with a single click.</strong>
</p>

<p align="center">
  <a href="README.tr.md">🇹🇷 Türkçe Dokümantasyon</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage-guide">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#security">Security</a> •
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC.svg?logo=visualstudiocode" alt="VS Code Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License MIT" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Cross-Platform" />
</p>

---

## ⚡ Overview

**Kiro Account Switcher** is an all-in-one account management and quota monitoring extension for Kiro AI in Visual Studio Code (and compatible editors such as Cursor, VSCodium, and Windsurf).

If you use multiple Kiro accounts (e.g. personal, work, trial accounts) to maximize available AI credits, this extension completely eliminates the tedious process of logging out, opening browsers, and re-authenticating every time your quota runs out.

---

## ✨ Features

- 🔄 **One-Click Account Switching**: Switch between saved accounts instantly. The active tokens are swapped atomically on disk.
- 📊 **Real-Time Quota & Credit Tracking**: Queries Kiro's `Get-Usage-Limits` API to display used/remaining credits, reset dates, subscription plan names, and user email.
- 🔑 **Dual Token Synchronization**: Simultaneously syncs both `kiro-auth-token-code.json` (VS Code extension) and `kiro-auth-token.json` (Kiro Desktop / Global CLI cache).
- 🔁 **Automatic Token Refresh**: Automatically detects expired tokens and refreshes Social OAuth tokens (Google, GitHub) via Kiro's desktop auth endpoint before switching.
- 🎨 **Modern Sidebar UI**: Sleek interactive Webview panel featuring avatar badges, live quota progress bars, plan tags, and drag-and-drop reordering.
- ⚡ **Quick Switch Menu (`Ctrl+Shift+K` / `Cmd+Shift+K`)**: Fast, keyboard-driven account switching with quick quota overview.
- 📌 **Status Bar Widget**: Shows active account name and quota progress (`[████░░]`) right in your editor status bar.
- 🛡️ **Encrypted Backup & Migration**:
  - Export accounts with optional **AES-256-GCM** encryption using a custom passphrase.
  - Import from Kiro Account Switcher backups.
  - Direct import compatibility with **Kiro Desktop** export files.
- 🔒 **Secure Credential Storage**: All sensitive access and refresh tokens are securely stored in VS Code's native OS-backed `SecretStorage` (Windows Credential Manager, macOS Keychain, Linux Secret Service).
- 🌐 **Bilingual Support**: Fully localized in **English** and **Turkish (Türkçe)** with live language switching.

---

## 🚀 Quick Start

### 1. Installation

#### From VSIX (Manual Installation)
1. Download or build the `.vsix` package:
   ```bash
   npm run package
   ```
2. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and run:
   > **Extensions: Install from VSIX...**
3. Select the generated `kiro-account-switcher-2.0.0.vsix` file.

*Alternatively, install via terminal:*
```bash
code --install-extension kiro-account-switcher-2.0.0.vsix
```

---

### 2. Saving Your First Account

1. Open VS Code and ensure you are logged into Kiro with your first account.
2. Click the **Kiro Accounts** icon in the Activity Bar on the left.
3. Click **"Save Current Account"** (or the `+` button in the header).
4. Enter a friendly name (e.g., `Personal`, `Work`, `Account 1`).
5. The extension will automatically retrieve your email and current quota limits!

---

### 3. Adding More Accounts

1. In the Kiro Account Switcher sidebar, click **"Sign Out & Add New Account"** (door icon).
2. The active token files will be cleared, prompting the official Kiro extension to show the sign-in prompt.
3. Sign in to your secondary account via the official Kiro panel.
4. Return to **Kiro Account Switcher** and click **"Save Current Account"**.
5. Repeat for as many accounts as you need!

---

### 4. Switching Accounts

- **Via Sidebar**: Click the **"Switch"** button on any account card.
- **Via Keyboard**: Press `Ctrl+Shift+K` (or `Cmd+Shift+K` on macOS) to bring up the Quick Switch palette and select an account.
- **Via Status Bar**: Click the Kiro status item in the bottom right corner of VS Code.

> **Note**: Kiro automatically detects token file modifications within ~3 to 5 seconds. If you want an immediate reload, you can enable `"kiroAccountSwitcher.autoReloadWindowOnSwitch": true` in settings.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Command | Description |
| :--- | :--- | :--- |
| `Ctrl+Shift+K` *(Windows/Linux)*<br>`Cmd+Shift+K` *(macOS)* | `kiroAccountSwitcher.quickSwitch` | Open the Quick Account Switcher palette |

---

## ⚙️ Configuration Settings

Customize the extension's behavior in **Settings** (`Ctrl+,` / `Cmd+,`) under **Extensions > Kiro Account Switcher**:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `kiroAccountSwitcher.syncBothTokenFiles` | `boolean` | `true` | Synchronizes both `kiro-auth-token-code.json` (VS Code) and `kiro-auth-token.json` (Kiro Desktop / Global) on switch or sign-out. |
| `kiroAccountSwitcher.fetchEmailAndQuota` | `boolean` | `true` | Queries Kiro's `Get-Usage-Limits` API to retrieve user email, user ID, subscription plan, and credit quota. |
| `kiroAccountSwitcher.autoReloadWindowOnSwitch` | `boolean` | `false` | Automatically reloads the VS Code window upon switching accounts. |
| `kiroAccountSwitcher.statusBarAlignment` | `"left"` \| `"right"` | `"right"` | Sets the position of the Kiro status bar widget. |
| `kiroAccountSwitcher.showProgressBar` | `boolean` | `true` | Shows a visual text progress bar (`[████░░]`) in the status bar hover tooltip. |

---

## 📂 Token Locations & Architecture

The extension manages tokens and cache files located in:

- **SSO Cache Directory**: `~/.aws/sso/cache/`
  - `kiro-auth-token-code.json` (VS Code Kiro extension)
  - `kiro-auth-token.json` (Kiro Desktop / Global IDE)
  - `kiro-connection-code.json` & `kiro-connection.json`
- **User Profile**:
  - **Windows**: `%APPDATA%\Code\User\globalStorage\kiro.kiro-for-vscode\profile.json`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/kiro.kiro-for-vscode/profile.json`
  - **Linux**: `~/.config/Code/User/globalStorage/kiro.kiro-for-vscode/profile.json`

File writes are performed **atomically** (write to unique temp file + rename) with strict file permissions (`0o600`) to prevent file corruption or race conditions.

---

## 🔒 Security & Privacy

- **Safe Credential Storage**: Authentication tokens are not stored in unencrypted configuration files. They are placed in VS Code's `vscode.SecretStorage`, protected by your operating system's native keychain.
- **Passphrase-Protected Exports**: Exported account backups can be encrypted using **AES-256-GCM** with **PBKDF2** key derivation (100,000 iterations). Plaintext export is also possible but explicitly warned.
- **Direct API Communication**: Quota queries and token refresh calls communicate directly with official Kiro endpoints (`desktop.kiro.dev`). No third-party servers, tracking, or telemetry are involved.
- **Symlink Protection**: File operations guard against symlink path traversal attacks.

---

## 🛠️ Development & Building

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [npm](https://www.npmjs.com/)

### Clone and Setup
```bash
git clone https://github.com/YOUR_USERNAME/kiro-account-switcher.git
cd kiro-account-switcher
npm install
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Bundles the extension using `esbuild` into `dist/extension.js` |
| `npm run watch` | Watches for file changes and rebuilds automatically |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting files (`tsc --noEmit`) |
| `npm run package` | Packages the extension into a ready-to-install `.vsix` file using `@vscode/vsce` |

### Debugging
1. Open the project folder in VS Code.
2. Press `F5` to start a new **Extension Development Host** window.
3. Test your changes in the new window.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ for the Kiro AI Community
</p>
