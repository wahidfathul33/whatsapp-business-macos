(function () {
  console.log("🚀 WhatsApp Inject Script Loaded");

  // ==========================================
  // 1. DARK MODE DETECTION & SYNC
  // ==========================================

  let currentTheme = "light";
  let systemTheme = "light";

  function detectSystemTheme() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  function detectWhatsAppTheme() {
    // Method 1: Check body/html class
    if (
      document.body.classList.contains("dark") ||
      document.documentElement.classList.contains("dark")
    ) {
      return "dark";
    }

    // Method 2: Check specific WhatsApp dark mode classes
    const darkModeSelectors = [
      '[data-theme="dark"]',
      ".dark-mode",
      ".theme-dark",
      "body.dark",
    ];

    for (const selector of darkModeSelectors) {
      if (document.querySelector(selector)) {
        return "dark";
      }
    }

    // Method 3: Check background color of main container
    const mainContainers = [
      "#app",
      '[data-testid="app-wrapper"]',
      ".app-wrapper-web",
      "body",
    ];

    for (const selector of mainContainers) {
      const element = document.querySelector(selector);
      if (element) {
        const bgColor = window.getComputedStyle(element).backgroundColor;
        // Parse RGB
        const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          // Calculate luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luminance < 128) {
            return "dark";
          }
        }
      }
    }

    return "light";
  }

  function applyTheme(theme) {
    if (currentTheme === theme) return;

    currentTheme = theme;
    document.documentElement.setAttribute("data-wa-theme", theme);

    console.log("🎨 Theme applied:", theme);

    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function checkAndApplyTheme() {
    const waTheme = detectWhatsAppTheme();
    applyTheme(waTheme);
  }

  // Watch for system theme changes
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    darkModeQuery.addListener((e) => {
      systemTheme = e.matches ? "dark" : "light";
      console.log("🌓 System theme changed:", systemTheme);
      checkAndApplyTheme();
    });
    systemTheme = detectSystemTheme();
  }

  // Watch for WhatsApp theme changes
  const themeObserver = new MutationObserver(() => {
    checkAndApplyTheme();
  });

  // Observe body and html for class/attribute changes
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });

  if (document.body) {
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
  }

  // Also observe #app container
  const observeApp = setInterval(() => {
    const app = document.querySelector("#app");
    if (app) {
      themeObserver.observe(app, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
      clearInterval(observeApp);
    }
  }, 500);

  // Initial theme detection
  setTimeout(checkAndApplyTheme, 1000);
  setInterval(checkAndApplyTheme, 5000); // Recheck every 5 seconds

  // ==========================================
  // 2. NOTIFICATION
  // ==========================================
  const OriginalNotification = window.Notification;
  let notificationCount = 0;

  window.Notification = function (title, options) {
    notificationCount++;
    const minimal = {
      body: options?.body || "New message",
      icon: options?.icon,
      silent: false,
      requireInteraction: false,
    };

    if (Notification.permission === "granted") {
      try {
        const notif = new OriginalNotification(title, minimal);
        return notif;
      } catch (e) {
        console.error("❌ Notification Error:", e);
      }
    }
    return null;
  };

  window.Notification.permission = OriginalNotification.permission;
  window.Notification.requestPermission =
    OriginalNotification.requestPermission.bind(OriginalNotification);

  // ==========================================
  // 3. FILE PREVIEW SYSTEM
  // ==========================================

  // Check if Electron APIs are available
  const fs = require?.("fs");
  const path = require?.("path");
  const os = require?.("os");
  const { shell } = require?.("electron") || {};
  const { nativeImage } = require?.("electron") || {};
  const { exec } = require?.("child_process") || {};

  if (!fs || !shell) {
    console.warn("⚠️ Electron API not available - file features disabled");
    return;
  }
  
  const pdfCache = new Map(); // Cache for PDF thumbnails

  // HARD PATCH: FORCE WHATSAPP DOWNLOAD PATH
  (function forceWhatsAppDownloadPath() {
    if (!fs || !path || !os) return;

    const SAVE_DIR = path.join(os.homedir(), "Downloads", "WhatsApp Business");

    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    console.log("📥 Forced download path:", SAVE_DIR);

    // Intercept all blob / download links
    document.addEventListener(
      "click",
      async (e) => {
        const link = e.target.closest("a");
        if (!link) return;

        const href = link.href || "";
        const filename =
          link.getAttribute("download") ||
          link.innerText?.trim() ||
          `WA-${Date.now()}`;

        const isBlob =
          href.startsWith("blob:") ||
          link.hasAttribute("download") ||
          href.includes("download");

        if (!isBlob) return;

        e.preventDefault();
        e.stopPropagation();

        try {
          console.log("⬇️ Intercepted download:", filename);

          const res = await fetch(href);
          const buffer = Buffer.from(await res.arrayBuffer());

          const safeName = filename
            .replace(/[<>:"/\\|?*]+/g, "_")
            .slice(0, 255);

          const filePath = path.join(SAVE_DIR, safeName);

          fs.writeFileSync(filePath, buffer);

          console.log("✅ Saved to:", filePath);

          // Show preview instead of auto open
          setTimeout(() => {
            showFilePreview(filePath);
          }, 300);
        } catch (err) {
          console.error("❌ Download intercept failed:", err);
        }
      },
      true,
    );
  })();

  // File type configurations
  const FILE_TYPES = {
    document: {
      extensions: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"],
      icon: "📄",
      color: "#5E35B1",
    },
    spreadsheet: {
      extensions: [".xlsx", ".xls", ".csv", ".ods"],
      icon: "📊",
      color: "#00A884",
    },
    presentation: {
      extensions: [".pptx", ".ppt", ".key", ".odp"],
      icon: "📽️",
      color: "#D65439",
    },
    archive: {
      extensions: [".zip", ".rar", ".7z", ".tar", ".gz"],
      icon: "📦",
      color: "#1976D2",
    },
    image: {
      extensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
      icon: "🖼️",
      color: "#8E24AA",
    },
    video: {
      extensions: [".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv"],
      icon: "🎥",
      color: "#C2185B",
    },
    audio: {
      extensions: [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"],
      icon: "🎵",
      color: "#F57C00",
    },
    database: {
      extensions: [
        ".sql",
        ".db",
        ".sqlite",
        ".sqlite3",
        ".mdb",
        ".accdb",
        ".psql",
        ".bak",
      ],
      icon: "🗄️",
      color: "#546E7A",
    },
  };

  function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    for (const [type, config] of Object.entries(FILE_TYPES)) {
      if (config.extensions.includes(ext)) {
        return { type, ...config };
      }
    }
    return { type: "unknown", icon: "📎", color: "#667781", extensions: [] };
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  // ==========================================
  // PDF THUMBNAIL GENERATOR
  // ==========================================

  function generatePDFThumbnail(pdfPath, callback) {
    // Check cache first
    if (pdfCache.has(pdfPath)) {
        setTimeout(() => {
            callback(pdfCache.get(pdfPath));
        }, 0);
        return;
    }
    
    if (!exec) {
      console.warn("⚠️ exec not available - PDF preview disabled");
      callback(null);
      return;
    }

    const tempDir = os.tmpdir();
    const outputPrefix = path.join(tempDir, `pdf_thumb_${Date.now()}`);

    // Use pdftoppm to convert first page to PNG
    const cmd = `pdftoppm -png -f 1 -l 1 -scale-to 800 "${pdfPath}" "${outputPrefix}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn("⚠️ PDF preview failed:", error.message);
        callback(null);
        return;
      }

      // Find generated PNG file
      const generatedFile = `${outputPrefix}-1.png`;

      if (!fs.existsSync(generatedFile)) {
        console.warn("⚠️ PDF thumbnail not generated");
        callback(null);
        return;
      }

      try {
        // Read the generated PNG
        const imageData = fs.readFileSync(generatedFile);
        const image = nativeImage.createFromBuffer(imageData);

        if (!image.isEmpty()) {
          const dataURL = image.toDataURL();
          // Cache the result
          pdfCache.set(pdfPath, dataURL);
          callback(dataURL);
        } else {
          callback(null);
        }

        // Clean up temp file
        fs.unlinkSync(generatedFile);
      } catch (e) {
        console.error("❌ Failed to process PDF thumbnail:", e);
        callback(null);
        // Try to clean up
        try {
          if (fs.existsSync(generatedFile)) {
            fs.unlinkSync(generatedFile);
          }
        } catch {}
      }
    });
  }

  // ==========================================
  // 4. FILE PREVIEW UI (WhatsApp Web Style)
  // ==========================================

  function injectPreviewStyles() {
    if (document.getElementById("whatsapp-preview-styles")) return;

    const style = document.createElement("style");
    style.id = "whatsapp-preview-styles";
    style.textContent = `
      /* WhatsApp Web Color Scheme */
      :root {
        --wa-bg-overlay: rgba(11, 20, 26, 0.92);
        --wa-bg-primary: #FFFFFF;
        --wa-bg-secondary: #F0F2F5;
        --wa-text-primary: #111B21;
        --wa-text-secondary: #667781;
        --wa-text-tertiary: #8696A0;
        --wa-border: #E9EDEF;
        --wa-green: #00A884;
        --wa-green-hover: #06CF9C;
        --wa-icon-bg: rgba(255, 255, 255, 0.1);
        --wa-icon-hover: rgba(255, 255, 255, 0.2);
        --wa-shadow: rgba(11, 20, 26, 0.1);
      }
      
      /* Dark Mode WhatsApp Colors */
      [data-wa-theme="dark"] {
        --wa-bg-overlay: rgba(0, 0, 0, 0.95);
        --wa-bg-primary: #111B21;
        --wa-bg-secondary: #0B141A;
        --wa-text-primary: #E9EDEF;
        --wa-text-secondary: #8696A0;
        --wa-text-tertiary: #667781;
        --wa-border: #2A3942;
        --wa-green: #00A884;
        --wa-green-hover: #06CF9C;
        --wa-icon-bg: rgba(255, 255, 255, 0.1);
        --wa-icon-hover: rgba(255, 255, 255, 0.15);
        --wa-shadow: rgba(0, 0, 0, 0.3);
      }
      
      /* Fullscreen Overlay */
      .wa-file-preview-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        background: var(--wa-bg-overlay);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      /* Header Bar - Fixed at top */
      .wa-file-preview-header {
        flex-shrink: 0;
        padding: 16px 20px;
        background: var(--wa-bg-primary);
        display: flex;
        align-items: center;
        gap: 16px;
        position: relative;
        z-index: 2;
      }
      
      .wa-file-preview-info {
        flex: 1;
        min-width: 0;
      }
      
      .wa-file-preview-close {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        flex-shrink: 0;
        line-height: 1;
        order: 2;
      }
      
      .wa-file-preview-close:hover {
        background: var(--wa-icon-hover);
      }
      
      .wa-file-preview-name {
        font-size: 16px;
        font-weight: 400;
        color: white;
        margin-bottom: 4px;
        line-height: 1.3;
        word-break: break-word;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      
      .wa-file-preview-meta {
        display: flex;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        align-items: center;
        flex-wrap: wrap;
      }
      
      .wa-file-preview-meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .wa-file-preview-meta-divider {
        color: rgba(255, 255, 255, 0.5);
        margin: 0 2px;
      }
      
      /* Content Area - Fullscreen center */
      .wa-file-preview-content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
        background: var(--wa-bg-overlay);
      }
      
      .wa-file-preview-thumbnail-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 20px;
      }
      
      .wa-file-preview-thumbnail-container.has-image {
        background: transparent;
      }
      
      .wa-file-preview-thumbnail {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        animation: zoomIn 0.3s ease-out;
      }
      
      @keyframes zoomIn {
        from { 
          opacity: 0;
          transform: scale(0.9);
        }
        to { 
          opacity: 1;
          transform: scale(1);
        }
      }
      
      .wa-file-preview-icon-large {
        font-size: 120px;
        opacity: 0.3;
        animation: iconFadeIn 0.4s ease-out;
      }
      
      @keyframes iconFadeIn {
        from { 
          opacity: 0;
          transform: scale(0.8);
        }
        to { 
          opacity: 0.3;
          transform: scale(1);
        }
      }
      
      /* Action Bar - Fixed at bottom */
      .wa-file-preview-actions {
        flex-shrink: 0;
        display: flex;
        gap: 12px;
        padding: 16px 20px;
        background: var(--wa-bg-primary);
        position: relative;
        z-index: 2;
      }
      
      .wa-file-preview-btn {
        flex: 1;
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: nowrap;
      }
      
      .wa-file-preview-btn svg {
        flex-shrink: 0;
      }
      
      .wa-file-preview-btn-primary {
        background: var(--wa-green);
        color: white;
      }
      
      .wa-file-preview-btn-primary:hover {
        background: var(--wa-green-hover);
      }
      
      .wa-file-preview-btn-secondary {
        background: var(--wa-bg-secondary);
        color: var(--wa-text-primary);
      }
      
      [data-wa-theme="dark"] .wa-file-preview-btn-secondary {
        background: #2A3942;
        color: var(--wa-text-primary);
      }
      
      .wa-file-preview-btn-secondary:hover {
        opacity: 0.9;
      }
      
      .wa-file-preview-btn:active {
        transform: scale(0.98);
      }
      
      /* Loading spinner */
      .wa-file-preview-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 16px;
      }
      
      .wa-file-preview-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: var(--wa-green);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      .wa-file-preview-loading-text {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* File type badge */
      .wa-file-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.9);
      }
      
      /* Mobile Responsive */
      @media (max-width: 768px) {
        .wa-file-preview-header {
          padding: 12px 16px;
        }
        
        .wa-file-preview-close {
          width: 40px;
          height: 40px;
          font-size: 20px;
        }
        
        .wa-file-preview-name {
          font-size: 15px;
          -webkit-line-clamp: 1;
        }
        
        .wa-file-preview-meta {
          font-size: 12px;
        }
        
        .wa-file-preview-actions {
          padding: 12px 16px;
          flex-direction: column;
        }
        
        .wa-file-preview-btn {
          padding: 12px 20px;
          font-size: 14px;
        }
        
        .wa-file-preview-thumbnail-container {
          padding: 10px;
        }
        
        .wa-file-preview-icon-large {
          font-size: 80px;
        }
      }
      
      /* Small Mobile */
      @media (max-width: 480px) {
        .wa-file-preview-name {
          font-size: 14px;
        }
        
        .wa-file-preview-meta {
          font-size: 11px;
        }
        
        .wa-file-preview-btn {
          padding: 10px 16px;
          font-size: 13px;
        }
        
        .wa-file-preview-icon-large {
          font-size: 64px;
        }
      }
      
      /* Landscape Mobile */
      @media (max-height: 500px) and (orientation: landscape) {
        .wa-file-preview-header {
          padding: 8px 16px;
        }
        
        .wa-file-preview-actions {
          padding: 8px 16px;
          flex-direction: row;
        }
        
        .wa-file-preview-btn {
          padding: 8px 16px;
          font-size: 13px;
        }
      }
      
      /* Smooth transitions */
      .wa-file-preview-header,
      .wa-file-preview-content,
      .wa-file-preview-actions,
      .wa-file-preview-btn,
      .wa-file-preview-close {
        transition: all 0.2s ease;
      }
    `;
    document.head.appendChild(style);
  }

  function createPreviewOverlay(fileInfo) {
    const overlay = document.createElement("div");
    overlay.className = "wa-file-preview-overlay";

    const fileType = getFileType(fileInfo.name);

    let thumbnailHTML = "";
    let hasImage = false;
    let isPDF =
      fileType.type === "document" &&
      fileInfo.path.toLowerCase().endsWith(".pdf");

    // Generate thumbnail for images
    if (fileType.type === "image" && nativeImage) {
      try {
        const image = nativeImage.createFromPath(fileInfo.path);
        if (!image.isEmpty()) {
          const dataURL = image.toDataURL();
          thumbnailHTML = `
            <div class="wa-file-preview-thumbnail-container has-image">
              <img src="${dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name}">
            </div>
          `;
          hasImage = true;
        }
      } catch (e) {
        console.error("Failed to create image thumbnail:", e);
      }
    }

    // Handle PDF with loading state
    if (isPDF && !hasImage) {
      thumbnailHTML = `
        <div class="wa-file-preview-thumbnail-container" id="pdf-thumbnail-container">
          <div class="wa-file-preview-loading">
            <div class="wa-file-preview-spinner"></div>
            <div class="wa-file-preview-loading-text">Loading preview...</div>
          </div>
        </div>
      `;
    }

    // If no image and not PDF, show icon
    if (!thumbnailHTML) {
      thumbnailHTML = `
        <div class="wa-file-preview-thumbnail-container">
          <div class="wa-file-preview-icon-large">${fileType.icon}</div>
        </div>
      `;
    }

    // Format date WhatsApp style
    const formatDate = (date) => {
      const now = new Date();
      const diff = now - date;
      const hours = Math.floor(diff / (1000 * 60 * 60));

      if (hours < 1) return "just now";
      if (hours < 24) return `${hours}h ago`;
      
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    overlay.innerHTML = `
      <div class="wa-file-preview-header">
        <div class="wa-file-preview-info">
          <div class="wa-file-preview-name">${fileInfo.name}</div>
          <div class="wa-file-preview-meta">
            <span class="wa-file-type-badge">${fileType.type.toUpperCase()}</span>
            <span class="wa-file-preview-meta-divider">•</span>
            <span class="wa-file-preview-meta-item">${fileInfo.size}</span>
            <span class="wa-file-preview-meta-divider">•</span>
            <span class="wa-file-preview-meta-item">${formatDate(fileInfo.modified)}</span>
          </div>
        </div>
        <button class="wa-file-preview-close" aria-label="Close">✕</button>
      </div>
      
      <div class="wa-file-preview-content">
        ${thumbnailHTML}
      </div>
      
      <div class="wa-file-preview-actions">
        <button class="wa-file-preview-btn wa-file-preview-btn-secondary" data-action="folder">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          Show in Folder
        </button>
        <button class="wa-file-preview-btn wa-file-preview-btn-primary" data-action="open">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          Open File
        </button>
      </div>
    `;

    // Generate PDF thumbnail after overlay is added to DOM
    if (isPDF) {
      generatePDFThumbnail(fileInfo.path, (dataURL) => {
        const thumbnailContainer = document.getElementById(
          "pdf-thumbnail-container",
        );
        if (thumbnailContainer) {
          if (dataURL) {
            thumbnailContainer.className =
              "wa-file-preview-thumbnail-container has-image";
            thumbnailContainer.innerHTML = `
              <img src="${dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name}">
            `;
          } else {
            // Fallback to icon if PDF generation failed
            thumbnailContainer.innerHTML = `
              <div class="wa-file-preview-icon-large">📄</div>
            `;
          }
        }
      });
    }

    // Event handlers
    const closeBtn = overlay.querySelector('.wa-file-preview-close');
    closeBtn.onclick = () => overlay.remove();

    overlay.querySelector('[data-action="open"]').onclick = () => {
      shell.openPath(fileInfo.path);
      overlay.remove();
    };

    overlay.querySelector('[data-action="folder"]').onclick = () => {
      shell.showItemInFolder(fileInfo.path);
      overlay.remove();
    };

    // Close on ESC key
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    overlay.onclick = (e) => {
      if (e.target === overlay || e.target.classList.contains('wa-file-preview-content')) {
        overlay.remove();
        document.removeEventListener("keydown", handleKeyDown);
      }
    };

    return overlay;
  }

  function showFilePreview(filePath) {
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    const fileInfo = {
      path: filePath,
      name: path.basename(filePath),
      size: formatFileSize(stats.size),
      modified: stats.mtime,
    };

    injectPreviewStyles();
    const overlay = createPreviewOverlay(fileInfo);
    document.body.appendChild(overlay);

    console.log("📋 Preview shown:", fileInfo.name);
  }

  // ==========================================
  // 6. CUSTOM FILE ATTACHMENT
  // ==========================================

  // File message bubbles
  function fileMessages() {
    const observer = new MutationObserver(() => {
      const fileMessages = document.querySelectorAll(
        '[data-icon="document"], [data-icon="audio-download"], [data-icon="video"]',
      );

      fileMessages.forEach((msg) => {
        if (msg.classList.contains("wa-processed")) return;
        msg.classList.add("wa-processed");

        msg.style.cursor = "pointer";
        msg.style.transition = "transform 0.2s";

        msg.addEventListener("mouseenter", () => {
          msg.style.transform = "scale(1.02)";
        });

        msg.addEventListener("mouseleave", () => {
          msg.style.transform = "scale(1)";
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fileMessages);
  } else {
    fileMessages();
  }

  console.log("✅ WhatsApp Features Loaded Successfully");
  console.log("🎨 Dark Mode: Auto-sync enabled");
})();