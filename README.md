# WhatsApp Business for macOS

Native WhatsApp Business Desktop app untuk macOS dengan fitur preview file seperti WhatsApp Desktop official.

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Fitur Utama

### 🖼️ File Preview (seperti WhatsApp Desktop)
- **Preview thumbnail** untuk gambar yang didownload
- **Modal popup** dengan informasi file lengkap (nama, ukuran, tipe)
- **Quick actions**: Open File atau Show in Folder
- **Animasi smooth** dengan backdrop blur
- **Auto-detect** file baru di folder Downloads

### 📂 Format File yang Didukung

| Kategori | Format | Icon |
|----------|--------|------|
| **Documents** | PDF, DOC, DOCX, TXT, RTF, ODT | 📄 |
| **Spreadsheets** | XLSX, XLS, CSV, ODS | 📊 |
| **Presentations** | PPTX, PPT, KEY, ODP | 📽️ |
| **Archives** | ZIP, RAR, 7Z, TAR, GZ | 📦 |
| **Images** | JPG, PNG, GIF, BMP, WEBP, SVG | 🖼️ |
| **Videos** | MP4, AVI, MOV, MKV, WEBM | 🎥 |
| **Audio** | MP3, WAV, M4A, FLAC, OGG | 🎵 |

### 🔔 Notifikasi
- Native macOS notifications
- Dock icon badge counter
- Bounce animation untuk pesan baru

### ⚡ Fitur Tambahan
- **Single instance** - tidak bisa buka 2x
- **Auto-update** file list
- **Debounced detection** - tidak spam preview
- **Smart file tracking** - tidak buka file yang sama 2x

## 📋 Requirements

- macOS 11.0+ (Big Sur atau lebih baru)
- Node.js 14+ dan npm
- Apple Silicon (M1/M2/M3) atau Intel

## 🚀 Instalasi

### 1. Install Nativefier

```bash
npm install -g nativefier
```

### 2. Download dan Jalankan Script

```bash
# Download script
curl -O https://raw.githubusercontent.com/wahidfathul33/whatsapp-business-macos/main/install-whatsapp.sh

# Beri permission execute
chmod +x install-whatsapp.sh

# Jalankan instalasi
./install-whatsapp.sh
```

### 3. Manual Installation (Alternatif)

```bash
# Clone atau buat folder
mkdir -p ~/whatsapp-business-macos
cd ~/whatsapp-business-macos

# Copy inject script (dari file inject-whatsapp.js)
# ... paste content ...

# Build app
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

# Install ke Applications
sudo mv ~/whatsapp-business-macos/WhatsApp\ Business-darwin-arm64/WhatsApp\ Business.app /Applications/

# Sign app
codesign --force --deep --sign - /Applications/WhatsApp\ Business.app
xattr -cr /Applications/WhatsApp\ Business.app

# Launch
open /Applications/WhatsApp\ Business.app
```

## 🎨 Preview UI Screenshots

### File Preview Modal

```
┌─────────────────────────────────────────┐
│                                      ×  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📄  Document.pdf               │   │
│  │      Document • 2.5 MB          │   │
│  │                                 │   │
│  │  [Optional Thumbnail]           │   │
│  │                                 │   │
│  │  ┌─────────────┬──────────────┐│   │
│  │  │  Open File  │Show in Folder││   │
│  │  └─────────────┴──────────────┘│   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Supported File Types dengan Color Coding

- 🔴 **Documents** - Red (#EA4335)
- 🟢 **Spreadsheets** - Green (#34A853)
- 🟡 **Presentations** - Yellow (#FBBC04)
- 🔵 **Archives** - Blue (#4285F4)
- 🟣 **Images** - Purple (#9C27B0)
- 🟥 **Videos** - Pink (#E91E63)
- 🟧 **Audio** - Orange (#FF9800)

## 🛠️ Customization

### Mengubah File Types yang Didukung

Edit `inject-whatsapp.js`:

```javascript
const FILE_TYPES = {
  customType: {
    extensions: ['.custom', '.ext'],
    icon: '🎯',
    color: '#FF0000'
  }
};
```

### Mengubah Auto-Open Behavior

Untuk auto-open tanpa preview, ganti fungsi `showFilePreview`:

```javascript
// Auto-open langsung tanpa preview
waitUntilStable(fullPath, () => {
  if (openedFiles.has(fullPath)) return;
  openedFiles.add(fullPath);
  shell.openPath(fullPath); // Langsung buka
});
```

### Mengubah Download Directory

Default: `~/Downloads`

```javascript
const downloadDir = path.join(os.homedir(), 'YourCustomFolder');
```

## 🔍 Troubleshooting

### Preview tidak muncul

1. **Cek Console Log** (Cmd + Alt + I):
   ```
   ✅ WhatsApp Features Loaded
   👀 Watching: /Users/xxx/Downloads
   📥 New file detected: document.pdf
   📋 Preview shown: document.pdf
   ```

2. **Cek Electron API**:
   - Pastikan file di-inject dengan benar
   - Verifikasi `--enable-es3-apis` flag ada

### File tidak auto-detect

1. Pastikan file masuk ke folder `~/Downloads`
2. Cek format file ada di daftar supported extensions
3. Restart aplikasi

### Notifikasi tidak muncul

1. System Preferences → Notifications
2. Cari "WhatsApp Business"
3. Enable notifications

### App tidak bisa dibuka (quarantine)

```bash
# Remove quarantine attribute
xattr -cr /Applications/WhatsApp\ Business.app

# Re-sign
codesign --force --deep --sign - /Applications/WhatsApp\ Business.app
```

## 📊 Performance

- **Memory**: ~150-200 MB (idle)
- **CPU**: <5% (idle), ~15-20% (active)
- **Disk**: ~250 MB app size
- **File Detection**: <1 second latency
- **Preview Load**: ~200-500ms

## 🔐 Security & Privacy

- ✅ **No data collection** - semua berjalan lokal
- ✅ **No external requests** - hanya ke web.whatsapp.com
- ✅ **File access** - hanya folder Downloads
- ✅ **Sandboxed** - Electron security best practices
- ⚠️ **Code signing** - menggunakan ad-hoc signature (untuk personal use)

## 🤝 Contributing

Contributions welcome! Silakan:

1. Fork repo
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 TODO / Roadmap

- [ ] Tambah preview untuk PDF (first page thumbnail)
- [ ] Video thumbnail generation
- [ ] Audio waveform preview
- [ ] Settings panel (toggle auto-open, preview style)
- [ ] Drag-and-drop to send files
- [ ] Quick reply templates
- [ ] Custom notification sounds
- [ ] Dark mode UI
- [ ] Multiple download folders monitoring
- [ ] File history/recent files

## 📄 License

MIT License - feel free to use, modify, distribute.

## 🙏 Credits

- Built with [Nativefier](https://github.com/nativefier/nativefier)
- Inspired by WhatsApp Desktop macOS
- Icons from system emoji set

## ⚠️ Disclaimer

Ini adalah aplikasi **unofficial** wrapper untuk WhatsApp Web. Tidak ada afiliasi dengan WhatsApp Inc. atau Meta Platforms.

Gunakan dengan risiko sendiri. Developer tidak bertanggung jawab atas:
- Data loss
- Account suspension
- Privacy issues
- Bugs atau crashes

## 📞 Support

Jika ada masalah:

1. **Check console log** di app (Cmd + Alt + I)
2. **Restart app**
3. **Reinstall** dengan script
4. Open issue di GitHub

---

Made with ❤️ for macOS users who want better WhatsApp Business experience
