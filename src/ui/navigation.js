// Navigation and UI panel management
export class NavigationController {
  constructor() {
    this.currentPanel = null;
  }

  initialize() {
    this.setupPanelToggles();
    console.log('Navigation controller initialized');
  }

  setupPanelToggles() {
    window.togglePanel = (panelId) => this.togglePanel(panelId);
    window.showStorageMonitor = () => this.showStorageMonitor();
    window.clearAllSessions = () => this.clearAllSessions();
    window.clearAllAppData = () => this.clearAllAppData();
  }

  togglePanel(panelId) {
    // Hide all panels first
    const panels = document.querySelectorAll('.bottom-popup');
    panels.forEach(panel => {
      if (panel.id !== panelId) {
        panel.classList.add('hidden');
      }
    });

    // Toggle the requested panel
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.toggle('hidden');
      this.currentPanel = targetPanel.classList.contains('hidden') ? null : panelId;
    }
  }

  showStorageMonitor() {
    const storageInfo = this.getStorageInfo();
    const message = `Storage Usage:
- Total: ${storageInfo.totalSizeKB} KB
- Photos: ${storageInfo.photoCount} (${storageInfo.photoSizeKB} KB)
- Usage: ${storageInfo.usagePercent}%
${storageInfo.isNearLimit ? '⚠️ Storage nearly full!' : ''}`;
    
    alert(message);
  }

  getStorageInfo() {
    let totalSize = 0;
    let photoCount = 0;
    let photoSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += new Blob([value]).size;
        
        // Count photos in sessions
        if (key === 'sessions') {
          try {
            const sessions = JSON.parse(value);
            sessions.forEach(session => {
              if (session.data) {
                session.data.forEach(entry => {
                  if (entry.type === 'photo' && entry.content) {
                    photoCount++;
                    photoSize += new Blob([entry.content]).size;
                  }
                });
              }
            });
          } catch (error) {
            console.warn('Error parsing sessions for storage info:', error);
          }
        }
      }
    }

    const maxSize = 5 * 1024 * 1024; // 5MB typical localStorage limit
    const usagePercent = (totalSize / maxSize) * 100;

    return {
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      photoCount,
      photoSizeKB: (photoSize / 1024).toFixed(1),
      usagePercent: usagePercent.toFixed(1),
      isNearLimit: usagePercent > 80
    };
  }

  clearAllSessions() {
    const confirmed = confirm('⚠️ Are you sure you want to clear all saved routes? This cannot be undone!');
    if (confirmed) {
      localStorage.removeItem('sessions');
      localStorage.removeItem('route_backup');
      alert('✅ All saved routes have been cleared!');
    }
  }

  clearAllAppData() {
    const confirmed = confirm('⚠️ This will permanently delete all routes, photos, and settings. Continue?');
    if (confirmed) {
      const keysToKeep = ['darkMode']; // Keep user preferences
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      alert('✅ All app data has been cleared!');
      location.reload();
    }
  }

  hideAllPanels() {
    const panels = document.querySelectorAll('.bottom-popup');
    panels.forEach(panel => panel.classList.add('hidden'));
    this.currentPanel = null;
  }

  cleanup() {
    // Remove global functions
    delete window.togglePanel;
    delete window.showStorageMonitor;
    delete window.clearAllSessions;
    delete window.clearAllAppData;
  }
}