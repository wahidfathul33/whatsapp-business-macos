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
  const cacheMetadata = new Map(); // Track cache timestamp and size
  
  // Cache configuration
  const CACHE_CONFIG = {
    MAX_ENTRIES: 50, // Maximum number of PDFs to cache
    MAX_SIZE_MB: 200, // Maximum total cache size in MB
    EXPIRY_HOURS: 24, // Cache expiry time in hours
  };
  
  // Cache management functions
  function getCacheSize() {
    let totalSize = 0;
    for (const [key, data] of pdfCache.entries()) {
      if (Array.isArray(data)) {
        // Multi-page PDF - sum all pages
        totalSize += data.reduce((sum, page) => {
          return sum + (page.dataURL ? page.dataURL.length : 0);
        }, 0);
      } else {
        // Single item
        totalSize += data.length || 0;
      }
    }
    return totalSize / (1024 * 1024); // Convert to MB
  }
  
  function isExpired(timestamp) {
    const now = Date.now();
    const expiryTime = CACHE_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000; // 24 hours in ms
    return (now - timestamp) > expiryTime;
  }
  
  function cleanExpiredCache() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, meta] of cacheMetadata.entries()) {
      if (isExpired(meta.timestamp)) {
        pdfCache.delete(key);
        cacheMetadata.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} expired PDF cache entries`);
    }
  }
  
  function enforceCache() {
    // Clean expired entries first
    cleanExpiredCache();
    
    // Check size limit
    let currentSize = getCacheSize();
    if (currentSize > CACHE_CONFIG.MAX_SIZE_MB) {
      console.log(`⚠️ Cache size (${currentSize.toFixed(2)}MB) exceeds limit, cleaning oldest entries...`);
      
      // Sort by timestamp (oldest first)
      const entries = Array.from(cacheMetadata.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest until under limit
      for (const [key] of entries) {
        pdfCache.delete(key);
        cacheMetadata.delete(key);
        currentSize = getCacheSize();
        
        if (currentSize <= CACHE_CONFIG.MAX_SIZE_MB * 0.8) { // 80% of limit
          break;
        }
      }
      
      console.log(`✅ Cache cleaned, new size: ${currentSize.toFixed(2)}MB`);
    }
    
    // Check entry count limit
    if (pdfCache.size > CACHE_CONFIG.MAX_ENTRIES) {
      console.log(`⚠️ Cache entries (${pdfCache.size}) exceeds limit, cleaning oldest...`);
      
      const entries = Array.from(cacheMetadata.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = pdfCache.size - Math.floor(CACHE_CONFIG.MAX_ENTRIES * 0.8);
      
      for (let i = 0; i < toRemove; i++) {
        const [key] = entries[i];
        pdfCache.delete(key);
        cacheMetadata.delete(key);
      }
      
      console.log(`✅ Cache entries cleaned, new count: ${pdfCache.size}`);
    }
  }
  
  function setCacheItem(key, value) {
    pdfCache.set(key, value);
    cacheMetadata.set(key, {
      timestamp: Date.now(),
      accessCount: 1,
    });
    enforceCache();
  }
  
  function getCacheItem(key) {
    if (!pdfCache.has(key)) {
      return null;
    }
    
    // Check if expired
    const meta = cacheMetadata.get(key);
    if (meta && isExpired(meta.timestamp)) {
      pdfCache.delete(key);
      cacheMetadata.delete(key);
      return null;
    }
    
    // Update access metadata
    if (meta) {
      meta.accessCount++;
      meta.lastAccess = Date.now();
    }
    
    return pdfCache.get(key);
  }
  
  // Clean expired cache every hour
  setInterval(cleanExpiredCache, 60 * 60 * 1000);

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
  // PDF THUMBNAIL GENERATOR (ALL PAGES WITH LAZY LOADING)
  // ==========================================

  function generatePDFThumbnails(pdfPath, callback, options = {}) {
    const { lazyLoad = true, pageRange = null } = options;
    
    // Check cache first
    const cacheKey = pageRange 
      ? `${pdfPath}_pages_${pageRange.start}-${pageRange.end}`
      : `${pdfPath}_all`;
    const cached = getCacheItem(cacheKey);
    
    if (cached) {
      console.log(`✅ Using cached PDF preview for: ${path.basename(pdfPath)}`);
      setTimeout(() => {
        callback(cached);
      }, 0);
      return;
    }
    
    if (!exec) {
      console.warn("⚠️ exec not available - PDF preview disabled");
      callback(null);
      return;
    }

    console.log(`🔄 Generating PDF preview for: ${path.basename(pdfPath)}`);
    
    const tempDir = os.tmpdir();
    const outputPrefix = path.join(tempDir, `pdf_thumb_${Date.now()}`);

    // First, get the total number of pages
    const getPageCountCmd = `pdfinfo "${pdfPath}" | grep "Pages:" | awk '{print $2}'`;
    
    exec(getPageCountCmd, (error, stdout, stderr) => {
      if (error) {
        console.warn("⚠️ Failed to get PDF page count:", error.message);
        callback(null);
        return;
      }

      const totalPages = parseInt(stdout.trim());
      if (!totalPages || totalPages < 1) {
        console.warn("⚠️ Invalid page count");
        callback(null);
        return;
      }

      console.log(`📄 PDF has ${totalPages} page(s)`);

      // Determine which pages to generate
      let startPage = 1;
      let endPage = totalPages;
      
      if (pageRange) {
        startPage = pageRange.start;
        endPage = pageRange.end;
      } else if (lazyLoad && totalPages > 2) {
        // Only generate first 2 pages initially for lazy loading
        endPage = 2;
      }

      // Convert specified pages to PNG
      const cmd = `pdftoppm -png -f ${startPage} -l ${endPage} -scale-to 900 "${pdfPath}" "${outputPrefix}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.warn("⚠️ PDF preview failed:", error.message);
          callback(null);
          return;
        }

        try {
          const images = [];
          
          // Read generated PNG files
          for (let i = startPage; i <= endPage; i++) {
            const pageFile = `${outputPrefix}-${i}.png`;
            
            if (!fs.existsSync(pageFile)) {
              console.warn(`⚠️ Page ${i} not generated`);
              continue;
            }

            const imageData = fs.readFileSync(pageFile);
            const image = nativeImage.createFromBuffer(imageData);

            if (!image.isEmpty()) {
              images.push({
                page: i,
                dataURL: image.toDataURL(),
                totalPages: totalPages
              });
            }

            // Clean up temp file
            fs.unlinkSync(pageFile);
          }

          if (images.length > 0) {
            // Cache the result with new cache system
            setCacheItem(cacheKey, images);
            
            const cacheSize = getCacheSize();
            console.log(`✅ Cached page(s) ${startPage}-${endPage} of ${totalPages} | Total cache: ${cacheSize.toFixed(2)}MB`);
            
            callback(images);
          } else {
            callback(null);
          }
        } catch (e) {
          console.error("❌ Failed to process PDF thumbnails:", e);
          callback(null);
          
          // Try to clean up any remaining temp files
          try {
            for (let i = startPage; i <= endPage; i++) {
              const pageFile = `${outputPrefix}-${i}.png`;
              if (fs.existsSync(pageFile)) {
                fs.unlinkSync(pageFile);
              }
            }
          } catch {}
        }
      });
    });
  }
  
  // Generate remaining PDF pages on demand
  function loadMorePDFPages(pdfPath, currentMaxPage, totalPages, callback) {
    const nextBatch = Math.min(currentMaxPage + 5, totalPages); // Load 5 pages at a time
    
    if (currentMaxPage >= totalPages) {
      callback(null);
      return;
    }
    
    console.log(`🔄 Loading PDF pages ${currentMaxPage + 1}-${nextBatch}...`);
    
    generatePDFThumbnails(pdfPath, callback, {
      lazyLoad: false,
      pageRange: { start: currentMaxPage + 1, end: nextBatch }
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
        background: var(--wa-icon-bg);
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
        cursor: default;
      }
      
      .wa-file-preview-thumbnail-container.has-image {
        background: transparent;
      }
      
      /* Scrollable container for multi-page PDFs */
      .wa-file-preview-thumbnail-container.scrollable {
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        overflow-y: auto;
        overflow-x: hidden;
        gap: 16px;
        padding: 20px;
      }
      
      /* Custom scrollbar for dark theme */
      .wa-file-preview-thumbnail-container.scrollable::-webkit-scrollbar {
        width: 8px;
      }
      
      .wa-file-preview-thumbnail-container.scrollable::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      
      .wa-file-preview-thumbnail-container.scrollable::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      
      .wa-file-preview-thumbnail-container.scrollable::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .wa-file-preview-thumbnail {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        animation: zoomIn 0.3s ease-out;
        cursor: default;
        pointer-events: auto;
      }
      
      /* For scrollable multi-page PDFs */
      .wa-file-preview-thumbnail-container.scrollable .wa-file-preview-thumbnail {
        max-width: 100%;
        height: auto;
        width: auto;
        flex-shrink: 0;
      }
      
      /* Page indicator for multi-page PDFs */
      .wa-pdf-page-wrapper {
        position: relative;
        width: auto;
        display: flex;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .wa-pdf-page-number {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        backdrop-filter: blur(4px);
        z-index: 1;
      }
      
      /* Lazy loading indicator */
      .wa-pdf-lazy-loader {
        width: 100%;
        padding: 40px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      
      .wa-pdf-lazy-loader-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: var(--wa-green);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      .wa-pdf-lazy-loader-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }
      
      /* Scroll sentinel for intersection observer */
      .wa-pdf-scroll-sentinel {
        width: 100%;
        height: 1px;
        flex-shrink: 0;
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
        cursor: default;
        pointer-events: auto;
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
        
        .wa-file-preview-thumbnail-container.scrollable {
          padding: 16px 10px;
          gap: 12px;
        }
        
        .wa-file-preview-icon-large {
          font-size: 80px;
        }
        
        .wa-pdf-page-number {
          font-size: 11px;
          padding: 3px 10px;
        }
        
        .wa-pdf-lazy-loader {
          padding: 30px 20px;
        }
        
        .wa-pdf-lazy-loader-spinner {
          width: 28px;
          height: 28px;
        }
        
        .wa-pdf-lazy-loader-text {
          font-size: 12px;
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
            <div class="wa-file-preview-loading-text">Loading PDF preview...</div>
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
      let currentMaxPage = 0;
      let totalPages = 0;
      let isLoading = false;
      let pdfFilePath = fileInfo.path;
      
      generatePDFThumbnails(fileInfo.path, (images) => {
        const thumbnailContainer = document.getElementById(
          "pdf-thumbnail-container",
        );
        if (!thumbnailContainer) return;
        
        if (images && images.length > 0) {
          totalPages = images[0].totalPages;
          currentMaxPage = images[images.length - 1].page;
          
          // Check if single page or multiple pages
          if (totalPages === 1) {
            // Single page - display centered
            thumbnailContainer.className =
              "wa-file-preview-thumbnail-container has-image";
            thumbnailContainer.innerHTML = `
              <img src="${images[0].dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name}">
            `;
          } else if (totalPages === 2 || currentMaxPage >= totalPages) {
            // Two pages or all pages loaded - normal scrollable layout
            thumbnailContainer.className =
              "wa-file-preview-thumbnail-container has-image scrollable";
            
            const pagesHTML = images.map((img) => `
              <div class="wa-pdf-page-wrapper">
                <img src="${img.dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name} - Page ${img.page}">
                <div class="wa-pdf-page-number">Page ${img.page} of ${totalPages}</div>
              </div>
            `).join('');
            
            thumbnailContainer.innerHTML = pagesHTML;
          } else {
            // More than 2 pages - lazy loading enabled
            thumbnailContainer.className =
              "wa-file-preview-thumbnail-container has-image scrollable";
            
            const pagesHTML = images.map((img) => `
              <div class="wa-pdf-page-wrapper">
                <img src="${img.dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name} - Page ${img.page}">
                <div class="wa-pdf-page-number">Page ${img.page} of ${totalPages}</div>
              </div>
            `).join('');
            
            // Add lazy loader and sentinel
            thumbnailContainer.innerHTML = pagesHTML + `
              <div class="wa-pdf-lazy-loader" id="pdf-lazy-loader">
                <div class="wa-pdf-lazy-loader-spinner"></div>
                <div class="wa-pdf-lazy-loader-text">Loading more pages...</div>
              </div>
              <div class="wa-pdf-scroll-sentinel" id="pdf-scroll-sentinel"></div>
            `;
            
            // Setup Intersection Observer for lazy loading
            const sentinel = document.getElementById('pdf-scroll-sentinel');
            const loader = document.getElementById('pdf-lazy-loader');
            
            if (sentinel && 'IntersectionObserver' in window) {
              const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting && !isLoading && currentMaxPage < totalPages) {
                    isLoading = true;
                    
                    // Show loader
                    if (loader) {
                      loader.style.display = 'flex';
                    }
                    
                    // Load next batch of pages
                    loadMorePDFPages(pdfFilePath, currentMaxPage, totalPages, (newImages) => {
                      if (newImages && newImages.length > 0) {
                        currentMaxPage = newImages[newImages.length - 1].page;
                        
                        // Insert new pages before the loader
                        const newPagesHTML = newImages.map((img) => `
                          <div class="wa-pdf-page-wrapper">
                            <img src="${img.dataURL}" class="wa-file-preview-thumbnail" alt="${fileInfo.name} - Page ${img.page}">
                            <div class="wa-pdf-page-number">Page ${img.page} of ${totalPages}</div>
                          </div>
                        `).join('');
                        
                        if (loader) {
                          loader.insertAdjacentHTML('beforebegin', newPagesHTML);
                        }
                        
                        // Check if all pages loaded
                        if (currentMaxPage >= totalPages) {
                          if (loader) loader.remove();
                          if (sentinel) sentinel.remove();
                          observer.disconnect();
                          console.log('✅ All PDF pages loaded');
                        }
                      }
                      
                      isLoading = false;
                      
                      // Hide loader
                      if (loader && currentMaxPage < totalPages) {
                        loader.style.display = 'none';
                      }
                    });
                  }
                });
              }, {
                root: thumbnailContainer,
                rootMargin: '200px', // Start loading 200px before reaching the end
                threshold: 0
              });
              
              observer.observe(sentinel);
            }
          }
        } else {
          // Fallback to icon if PDF generation failed
          thumbnailContainer.innerHTML = `
            <div class="wa-file-preview-icon-large">📄</div>
          `;
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

    // Click handlers for closing
    overlay.onclick = (e) => {
      // Close if clicked on overlay background or content area
      if (e.target === overlay || e.target.classList.contains('wa-file-preview-content')) {
        overlay.remove();
        document.removeEventListener("keydown", handleKeyDown);
      }
    };

    // Close when clicking thumbnail container but NOT the thumbnail itself
    const thumbnailContainer = overlay.querySelector('.wa-file-preview-thumbnail-container');
    if (thumbnailContainer) {
      thumbnailContainer.onclick = (e) => {
        // Only close if clicking the container itself, not the thumbnail image, icon, or page wrapper
        if (e.target === thumbnailContainer || 
            e.target.classList.contains('wa-file-preview-thumbnail-container')) {
          overlay.remove();
          document.removeEventListener("keydown", handleKeyDown);
        }
        // Don't close if clicking on page number badge
        if (e.target.classList.contains('wa-pdf-page-number')) {
          e.stopPropagation();
        }
      };
    }

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