# 🚀 Quick Start Guide - WhatsApp Business

## Installation (Copy-Paste Ready)

### Option 1: One-Line Install

```bash
bash <(curl -s https://raw.githubusercontent.com/wahidfathul33/whatsapp-business-macos/main/install-whatsapp.sh)
```

### Option 2: Manual Install

```bash
# 1. Install Nativefier
npm install -g nativefier

# 2. Create workspace
mkdir -p ~/whatsapp-business-macos
cd ~/whatsapp-business-macos

# 3. Create inject script
curl -o inject-whatsapp.js https://raw.githubusercontent.com/wahidfathul33/whatsapp-business-macos/main/inject-whatsapp.js

# 4. Build
nativefier "https://web.whatsapp.com/" \
  --name "WhatsApp Business" \
  --platform mac \
  --arch arm64 \
  --single-instance \
  --counter \
  --bounce \
  --app-bundle-id "com.whatsapp.business.desktop" \
  --enable-es3-apis \
  --inject ~/whatsapp-business-macos/inject-whatsapp.js

# 5. Install
sudo mv ~/whatsapp-business-macos/WhatsApp\ Business-darwin-arm64/WhatsApp\ Business.app /Applications/

# 6. Sign
codesign --force --deep --sign - /Applications/WhatsApp\ Business.app
xattr -cr /Applications/WhatsApp\ Business.app

# 7. Launch
open /Applications/WhatsApp\ Business.app
```

## How It Works

### File Preview Flow

```
Download File
    ↓
Detected in ~/Downloads
    ↓
Wait for stable (file complete)
    ↓
Show Preview Modal
    ↓
User clicks "Open" or "Show in Folder"
    ↓
Open with default app / Finder
```

### UI Interaction

1. **File downloaded** → Preview modal muncul otomatis
2. **Click backdrop** atau **× button** → Close preview
3. **"Open File"** → Buka dengan aplikasi default
4. **"Show in Folder"** → Buka Finder di lokasi file

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close preview modal |
| `Enter` | Open file (when modal focused) |
| `Cmd + W` | Close window |
| `Cmd + R` | Reload page |
| `Cmd + Alt + I` | Open DevTools (debug) |

## Common Use Cases

### 1. Receive Invoice (PDF)

```
Client sends invoice.pdf
    ↓
File downloaded to ~/Downloads
    ↓
Preview shows: "invoice.pdf • Document • 1.2 MB"
    ↓
Click "Open File" → PDF opens in Preview.app
```

### 2. Receive Image

```
Client sends photo.jpg
    ↓
Preview shows thumbnail + "photo.jpg • Image • 3.4 MB"
    ↓
Click "Open File" → Opens in default viewer
```

### 3. Receive Archive

```
Client sends files.zip
    ↓
Preview shows: "files.zip • Archive • 15 MB"
    ↓
Click "Show in Folder" → Finder opens to Downloads
```

## Troubleshooting Quick Fixes

### Issue: Preview not showing

```bash
# Solution 1: Check if script is injected
open -a "WhatsApp Business" # Launch app
# Press Cmd + Alt + I
# Look for: "✅ WhatsApp Features Loaded"

# Solution 2: Reinstall
sudo rm -rf /Applications/WhatsApp\ Business.app
# Run install script again
```

### Issue: "App is damaged"

```bash
# Remove quarantine
xattr -cr /Applications/WhatsApp\ Business.app

# Re-sign
codesign --force --deep --sign - /Applications/WhatsApp\ Business.app
```

### Issue: Notifications not working

1. System Preferences → Notifications
2. Find "WhatsApp Business"
3. Enable all options:
   - ✅ Allow Notifications
   - ✅ Badges
   - ✅ Sounds
   - ✅ Banners

### Issue: File already opened, preview shows again

```bash
# This is prevented by default
# But if it happens, restart app:
killall "WhatsApp Business"
open /Applications/WhatsApp\ Business.app
```

## Customization Examples

### Change Preview Timeout

Edit `inject-whatsapp.js`:

```javascript
// Line ~300 (approximately)
setTimeout(() => {
  // ... preview logic
}, 1000) // Change from 1000ms to your preferred delay
```

### Disable Preview, Enable Auto-Open

Replace preview function:

```javascript
// Instead of: showFilePreview(fullPath);
// Use:
shell.openPath(fullPath);
```

### Add Custom File Type

```javascript
const FILE_TYPES = {
  // ... existing types
  ebook: {
    extensions: ['.epub', '.mobi', '.azw'],
    icon: '📚',
    color: '#FF6B6B'
  }
};
```

## Testing

### Test File Detection

```bash
# In terminal:
cd ~/Downloads

# Create test file
echo "test" > test_document.pdf

# Watch app - preview should appear
```

### Test Different File Types

```bash
cd ~/Downloads

# Document
touch test.pdf

# Spreadsheet
touch test.xlsx

# Archive
touch test.zip

# Image (download any image)
curl -o test.jpg https://picsum.photos/200
```

## Uninstall

```bash
# Remove app
sudo rm -rf /Applications/WhatsApp\ Business.app

# Remove workspace (optional)
rm -rf ~/whatsapp-business-macos

# Uninstall nativefier (optional)
npm uninstall -g nativefier
```

## Update App

```bash
# Just reinstall - settings will be preserved
cd ~/whatsapp-business-macos
bash install-whatsapp.sh
```

## Performance Tips

1. **Close unused tabs** - WhatsApp Business only
2. **Clear cache** periodically:
   ```bash
   rm -rf ~/Library/Application\ Support/WhatsApp\ Business/
   ```
3. **Restart app** weekly for best performance
4. **Limit open chats** - close old conversations

## FAQ

**Q: Will my chats sync with mobile?**
A: Yes, it's WhatsApp Web - full sync with your phone.

**Q: Can I use multiple accounts?**
A: No, single instance only. Use different browsers for multiple accounts.

**Q: Does it work offline?**
A: No, requires internet like WhatsApp Web.

**Q: Is it safe?**
A: Yes, just a wrapper. No data collection, local only.

**Q: Can I backup chats?**
A: Use WhatsApp's built-in export feature in each chat.

**Q: File preview shows wrong icon?**
A: Check file extension is in supported list, otherwise customize in script.

## Advanced: Console Debugging

```javascript
// Open DevTools (Cmd + Alt + I)
// Run in console:

// Check if features loaded
console.log( loaded:', window.Notification !== undefined);

// List opened files
// (This requires exposing openedFiles variable - add to inject script)

// Manual file preview test
// (Add test function to inject script)
```

---

## Support & Updates

- 📖 Full README: [README.md](README.md)
- 🐛 Report bugs: GitHub Issues
- 💡 Feature requests: GitHub Issues
- ⭐ Star the repo if helpful!

---

**Last Updated**: 2025-02-06
**Version**: 1.0.0
**Platform**: macOS 11.0+
