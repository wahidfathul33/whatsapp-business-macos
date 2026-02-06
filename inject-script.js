(function() {
  console.log('🚀 WhatsApp Inject Script Loaded');
  
  // ==========================================
  // 1. NOTIFICATION
  // ==========================================
  const OriginalNotification = window.Notification;
  let notificationCount = 0;
  
  window.Notification = function(title, options) {
    notificationCount++;
    const minimal = {
      body: options?.body || 'New message',
      icon: options?.icon,
      silent: false,
      requireInteraction: false
    };
    
    if (Notification.permission === 'granted') {
      try {
        const notif = new OriginalNotification(title, minimal);
        return notif;
      } catch (e) {
        console.error('❌ Notification Error:', e);
      }
    }
    return null;
  };
  
  window.Notification.permission = OriginalNotification.permission;
  window.Notification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
  
  // ==========================================
  // 2. FILE PREVIEW SYSTEM
  // ==========================================
  
  // Check if Electron APIs are available
  const fs = require?.('fs');
  const path = require?.('path');
  const os = require?.('os');
  const { shell } = require?.('electron') || {};
  const { nativeImage } = require?.('electron') || {};
  
  if (!fs || !shell) {
    console.warn('⚠️ Electron API not available - file features disabled');
    return;
  }
  
  const downloadDir = path.join(os.homedir(), 'Downloads');
  const openedFiles = new Set();
  const timers = new Map();
  
  // File type configurations
  const FILE_TYPES = {
    document: {
      extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
      icon: '📄',
      color: '#EA4335'
    },
    spreadsheet: {
      extensions: ['.xlsx', '.xls', '.csv', '.ods'],
      icon: '📊',
      color: '#34A853'
    },
    presentation: {
      extensions: ['.pptx', '.ppt', '.key', '.odp'],
      icon: '📽️',
      color: '#FBBC04'
    },
    archive: {
      extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
      icon: '📦',
      color: '#4285F4'
    },
    image: {
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
      icon: '🖼️',
      color: '#9C27B0'
    },
    video: {
      extensions: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'],
      icon: '🎥',
      color: '#E91E63'
    },
    audio: {
      extensions: ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'],
      icon: '🎵',
      color: '#FF9800'
    },
    database: {
      extensions: ['.sql', '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.psql', '.bak'],
      icon: '🗄️',
      color: '#607D8B'
    }
  };
  
  function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    for (const [type, config] of Object.entries(FILE_TYPES)) {
      if (config.extensions.includes(ext)) {
        return { type, ...config };
      }
    }
    return { type: 'unknown', icon: '📎', color: '#757575', extensions: [] };
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  function isSupported(filename) {
    return Object.values(FILE_TYPES).some(config =>
      config.extensions.some(ext => filename.toLowerCase().endsWith(ext))
    );
  }
  
  function waitUntilStable(file, callback) {
    let lastSize = -1;
    let stableCount = 0;
    
    const interval = setInterval(() => {
      if (!fs.existsSync(file)) {
        clearInterval(interval);
        return;
      }
      
      const size = fs.statSync(file).size;
      if (size === lastSize && size > 0) {
        stableCount++;
        if (stableCount >= 2) {
          clearInterval(interval);
          callback();
        }
      } else {
        lastSize = size;
        stableCount = 0;
      }
    }, 500);
  }
  
  // ==========================================
  // 3. FILE PREVIEW UI INJECTION
  // ==========================================
  
  function injectPreviewStyles() {
    if (document.getElementById('whatsapp-preview-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'whatsapp-preview-styles';
    style.textContent = `
      .wa-file-preview-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .wa-file-preview-container {
        background: #1f2937;
        border-radius: 20px;
        padding: 0;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.7);
        animation: slideUp 0.3s ease-out;
        overflow: hidden;
      }
      
      .wa-file-preview-content {
        background: white;
        border-radius: 16px;
        margin: 4px;
      }
      
      .wa-file-preview-thumbnail-container {
        width: 100%;
        min-height: 300px;
        max-height: 400px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      
      .wa-file-preview-thumbnail-container.has-image {
        background: #000;
      }
      
      .wa-file-preview-thumbnail {
        max-width: 100%;
        max-height: 400px;
        object-fit: contain;
      }
      
      .wa-file-preview-icon-large {
        font-size: 120px;
        opacity: 0.9;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        animation: iconPulse 2s ease-in-out infinite;
      }
      
      @keyframes iconPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      .wa-file-preview-header {
        padding: 20px 24px;
        border-bottom: 1px solid #f3f4f6;
      }
      
      .wa-file-preview-name {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 8px;
        line-height: 1.4;
        word-break: break-word;
      }
      
      .wa-file-preview-meta {
        display: flex;
        gap: 12px;
        font-size: 14px;
        color: #6b7280;
        align-items: center;
      }
      
      .wa-file-preview-meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .wa-file-preview-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .wa-file-preview-actions {
        display: flex;
        gap: 12px;
        padding: 20px 24px;
      }
      
      .wa-file-preview-btn {
        flex: 1;
        padding: 14px 24px;
        border-radius: 12px;
        border: none;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      .wa-file-preview-btn-primary {
        background: #25D366;
        color: white;
        box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
      }
      
      .wa-file-preview-btn-primary:hover {
        background: #20BA5A;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4);
      }
      
      .wa-file-preview-btn-primary:active {
        transform: translateY(0);
      }
      
      .wa-file-preview-btn-secondary {
        background: #f3f4f6;
        color: #1f2937;
      }
      
      .wa-file-preview-btn-secondary:hover {
        background: #e5e7eb;
        transform: translateY(-1px);
      }
      
      .wa-file-preview-close {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        cursor: pointer;
      }

      .wa-file-preview-close::before,
      .wa-file-preview-close::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 18px;
        height: 2px;
        background: white;
        transform-origin: center;
      }

      .wa-file-preview-close::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .wa-file-preview-close::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }

      
      .wa-file-preview-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
      
      .wa-file-preview-close:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);
  }
  
  function createPreviewOverlay(fileInfo) {
    const overlay = document.createElement('div');
    overlay.className = 'wa-file-preview-overlay';
    
    const container = document.createElement('div');
    container.className = 'wa-file-preview-container';
    
    const content = document.createElement('div');
    content.className = 'wa-file-preview-content';
    
    const fileType = getFileType(fileInfo.name);
    
    let thumbnailHTML = '';
    let hasImage = false;
    
    // Generate thumbnail for images
    if (fileType.type === 'image' && nativeImage) {
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
        console.error('Failed to create image thumbnail:', e);
      }
    }
    
    // If no image, show icon with gradient background
    if (!hasImage) {
      const gradients = {
        document: 'linear-gradient(135deg, #EA4335 0%, #FF6B6B 100%)',
        spreadsheet: 'linear-gradient(135deg, #34A853 0%, #4CAF50 100%)',
        presentation: 'linear-gradient(135deg, #FBBC04 0%, #FFA726 100%)',
        archive: 'linear-gradient(135deg, #4285F4 0%, #42A5F5 100%)',
        image: 'linear-gradient(135deg, #9C27B0 0%, #BA68C8 100%)',
        video: 'linear-gradient(135deg, #E91E63 0%, #F06292 100%)',
        audio: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)',
        unknown: 'linear-gradient(135deg, #757575 0%, #9E9E9E 100%)'
      };
      
      thumbnailHTML = `
        <div class="wa-file-preview-thumbnail-container" style="background: ${gradients[fileType.type] || gradients.unknown}">
          <div class="wa-file-preview-icon-large">${fileType.icon}</div>
        </div>
      `;
    }
    
    // Format date
    const formatDate = (date) => {
      const now = new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    };
    
    content.innerHTML = `
      ${thumbnailHTML}
      
      <div class="wa-file-preview-header">
        <div class="wa-file-preview-name">${fileInfo.name}</div>
        <div class="wa-file-preview-meta">
          <div class="wa-file-preview-meta-item">
            <span class="wa-file-preview-badge" style="background-color: ${fileType.color}20; color: ${fileType.color};">
              ${fileType.icon} ${fileType.type}
            </span>
          </div>
          <div class="wa-file-preview-meta-item">
            📦 ${fileInfo.size}
          </div>
          <div class="wa-file-preview-meta-item">
            🕐 ${formatDate(fileInfo.modified)}
          </div>
        </div>
      </div>
      
      <div class="wa-file-preview-actions">
        <button class="wa-file-preview-btn wa-file-preview-btn-primary" data-action="open">
          📂 Open File
        </button>
        <button class="wa-file-preview-btn wa-file-preview-btn-secondary" data-action="folder">
          📁 Show in Folder
        </button>
      </div>
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wa-file-preview-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close preview');
    closeBtn.onclick = () => overlay.remove();
    
    container.appendChild(content);
    overlay.appendChild(closeBtn);
    overlay.appendChild(container);
    
    // Event handlers
    content.querySelector('[data-action="open"]').onclick = () => {
      shell.openPath(fileInfo.path);
      overlay.remove();
    };
    
    content.querySelector('[data-action="folder"]').onclick = () => {
      shell.showItemInFolder(fileInfo.path);
      overlay.remove();
    };
    
    // Close on ESC key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        document.removeEventListener('keydown', handleKeyDown);
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
      modified: stats.mtime
    };
    
    injectPreviewStyles();
    const overlay = createPreviewOverlay(fileInfo);
    document.body.appendChild(overlay);
    
    console.log('📋 Preview shown:', fileInfo.name);
  }
  
  // ==========================================
  // 4. FILE DOWNLOAD WATCHER
  // ==========================================
  
  try {
    fs.watch(downloadDir, (event, filename) => {
      if (!filename) return;
      if (!isSupported(filename)) return;
      
      const fullPath = path.join(downloadDir, filename);
      
      // Skip if already opened
      if (openedFiles.has(fullPath)) return;
      
      // Debounce file events
      if (timers.has(fullPath)) {
        clearTimeout(timers.get(fullPath));
      }
      
      timers.set(
        fullPath,
        setTimeout(() => {
          if (!fs.existsSync(fullPath)) return;
          
          waitUntilStable(fullPath, () => {
            if (openedFiles.has(fullPath)) return;
            openedFiles.add(fullPath);
            
            console.log('📥 New file detected:', filename);
            
            // Show preview instead of auto-opening
            showFilePreview(fullPath);
          });
        }, 1000)
      );
    });
    
    console.log('👀 Watching downloads folder:', downloadDir);
  } catch (error) {
    console.error('❌ Failed to watch downloads folder:', error);
  }
  
  // ==========================================
  // 5. CUSTOM FILE ATTACHMENT
  // ==========================================
  
  // File message bubbles
  function fileMessages() {
    const observer = new MutationObserver(() => {
      const fileMessages = document.querySelectorAll('[data-icon="document"], [data-icon="audio-download"], [data-icon="video"]');
      
      fileMessages.forEach(msg => {
        if (msg.classList.contains('wa-processed')) return;
        msg.classList.add('wa-processed');
        
        msg.style.cursor = 'pointer';
        msg.style.transition = 'transform 0.2s';
        
        msg.addEventListener('mouseenter', () => {
          msg.style.transform = 'scale(1.02)';
        });
        
        msg.addEventListener('mouseleave', () => {
          msg.style.transform = 'scale(1)';
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fileMessages);
  } else {
    fileMessages();
  }
  
  console.log('✅ WhatsApp Features Loaded Successfully');
  
})();
