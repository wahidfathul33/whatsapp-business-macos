#!/bin/bash

# WhatsApp Business macOS - Installation Script
# Features: File Preview, Auto-open, Notifications, Dark Mode

set -e

echo "🚀 WhatsApp Business - Installation Script"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check requirements
echo -e "${BLUE}📋 Checking requirements...${NC}"

if ! command -v nativefier &> /dev/null; then
    echo -e "${RED}❌ Nativefier not found!${NC}"
    echo "Install with: npm install -g nativefier"
    exit 1
fi

echo -e "${GREEN}✅ Nativefier found${NC}"

# Check for pdf-poppler (for PDF preview)
if ! command -v pdftoppm &> /dev/null; then
    echo -e "${YELLOW}⚠️  poppler not found - PDF preview will be limited${NC}"
    echo -e "${YELLOW}   Install with: brew install poppler${NC}"
else
    echo -e "${GREEN}✅ Poppler found (PDF preview enabled)${NC}"
fi

# Step 2: Setup directories
echo -e "${BLUE}📁 Setting up directories...${NC}"

WORK_DIR=~/whatsapp-business-macos
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo -e "${GREEN}✅ Working directory: $WORK_DIR${NC}"

# Step 4: Download icon (if not exists)
if [ ! -f "WhatsApp_Business.icns" ]; then
    echo -e "${BLUE}🎨 Downloading WhatsApp Business icon...${NC}"
    
    # Try to download icon, if fails use default
    curl -L "https://upload.wikimedia.org/wikipedia/commons/5/5e/WhatsApp_icon.png" \
         -o wa_temp.png 2>/dev/null || true
    
    if [ -f "wa_temp.png" ]; then
        # Convert to icns if sips is available
        if command -v sips &> /dev/null; then
            mkdir -p wa_icon.iconset
            sips -z 512 512 wa_temp.png --out wa_icon.iconset/icon_512x512.png
            sips -z 256 256 wa_temp.png --out wa_icon.iconset/icon_256x256.png
            sips -z 128 128 wa_temp.png --out wa_icon.iconset/icon_128x128.png
            iconutil -c icns wa_icon.iconset -o WhatsApp_Business.icns
            rm -rf wa_icon.iconset wa_temp.png
            echo -e "${GREEN}✅ Icon created${NC}"
        else
            rm wa_temp.png
            echo -e "${YELLOW}⚠️  Icon conversion skipped${NC}"
        fi
    fi
fi

# Step 5: Remove old app
echo -e "${BLUE}🗑️  Removing old app...${NC}"
sudo rm -rf /Applications/WhatsApp\ Business.app 2>/dev/null || true
echo -e "${GREEN}✅ Old app removed${NC}"

# Step 6: Build with Nativefier
echo -e "${BLUE}🔨 Building WhatsApp Business app...${NC}"

ICON_FLAG=""
if [ -f "WhatsApp_Business.icns" ]; then
    ICON_FLAG="--icon $WORK_DIR/WhatsApp_Business.icns"
fi

nativefier "https://web.whatsapp.com/" \
  --name "WhatsApp Business" \
  --platform mac \
  --arch arm64 \
  --single-instance \
  --counter \
  --bounce \
  --app-bundle-id "com.whatsapp.business.desktop" \
  $ICON_FLAG \
  --enable-es3-apis \
  --inject "$WORK_DIR/inject-script.js"

echo -e "${GREEN}✅ App built successfully${NC}"

# Step 7: Install to Applications
echo -e "${BLUE}📦 Installing to Applications...${NC}"

APP_PATH=$(find "$WORK_DIR" -name "WhatsApp Business-darwin-arm64" -type d | head -n 1)

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ Build failed - app not found${NC}"
    exit 1
fi

sudo mv "$APP_PATH/WhatsApp Business.app" /Applications/
rm -rf "$APP_PATH"

echo -e "${GREEN}✅ App installed${NC}"

# Step 8: Code signing
echo -e "${BLUE}🔐 Signing app...${NC}"
codesign --force --deep --sign - /Applications/WhatsApp\ Business.app
xattr -cr /Applications/WhatsApp\ Business.app
echo -e "${GREEN}✅ App signed${NC}"

# Step 9: Final report
echo ""
echo "=================================================="
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo "=================================================="
echo ""
echo "App Location: /Applications/WhatsApp Business.app"
echo ""
echo "Features:"
echo "  ✓ 🌓 Dark Mode (Auto-sync with WhatsApp/System)"
echo "  ✓ 📋 File preview with thumbnails"
echo "  ✓ 📄 PDF preview (first page thumbnail)"
echo "  ✓ 📥 Auto-detect downloads"
echo "  ✓ 🔔 Smart notifications"
echo "  ✓ 📁 Supported formats:"
echo "    • Documents: PDF, DOCX, TXT, etc."
echo "    • Spreadsheets: XLSX, CSV, etc."
echo "    • Presentations: PPTX, KEY, etc."
echo "    • Archives: ZIP, RAR, 7Z, etc."
echo "    • Media: Images, Videos, Audio"
echo "    • Database: SQL, SQLite, etc."
echo ""
echo -e "${BLUE}Dark Mode Features:${NC}"
echo "  • Automatically detects WhatsApp theme"
echo "  • Falls back to system theme preference"
echo "  • Smooth transitions between themes"
echo "  • All UI elements adapt to theme"
echo ""
echo -e "${BLUE}PDF Preview Features:${NC}"
echo "  • First page thumbnail generation"
echo "  • Smart caching for performance"
echo "  • Fallback to icon if generation fails"
echo "  • Loading indicator during generation"
echo ""
if ! command -v pdftoppm &> /dev/null; then
    echo -e "${YELLOW}⚠️  For full PDF preview support, install poppler:${NC}"
    echo "   brew install poppler"
    echo ""
fi
echo -e "${BLUE}🚀 Launching app...${NC}"
open /Applications/WhatsApp\ Business.app

echo ""
echo "To reinstall later, run:"
echo "  bash ~/whatsapp-business-macos/install-whatsapp.sh"
echo ""