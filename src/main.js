// Main application entry point with all modules
import { AppState } from './core/storage.js';
import { MapController } from './core/map.js';
import { TrackingController } from './core/tracking.js';
import { TimerController } from './core/timer.js';
import { NavigationController } from './ui/navigation.js';
import { CompassController } from './ui/compass.js';
import { AccessibilityForm } from './features/accessibility.js';
import { MediaController } from './features/media.js';
import { ExportController } from './features/export.js';
import { FirebaseController } from './features/firebase.js';
import { AuthController } from './features/auth.js';

class AccessNatureApp {
  constructor() {
    this.controllers = {};
    this.isInitialized = false;
  }

// UPDATED: Initialize method with backup restore handling
async initialize() {
  if (this.isInitialized) return;

  try {
    console.log('🌲 Access Nature starting...');

    // Initialize core systems
    this.controllers.state = new AppState();
    this.controllers.map = new MapController();
    this.controllers.tracking = new TrackingController(this.controllers.state);
    this.controllers.timer = new TimerController();

    // Initialize UI controllers
    this.controllers.navigation = new NavigationController();
    this.controllers.compass = new CompassController();

    // Initialize feature controllers
    this.controllers.accessibility = new AccessibilityForm();
    this.controllers.media = new MediaController(this.controllers.state);
    this.controllers.export = new ExportController(this.controllers.state);
    this.controllers.firebase = new FirebaseController();
    this.controllers.auth = new AuthController();

    // Set up dependencies
    this.setupControllerDependencies();

    // Initialize all controllers
    await this.initializeControllers();

    // Set up the main UI event listeners
    this.setupMainEventListeners();

    // Set up error handling
    this.setupErrorHandling();

    // NEW: Check for unsaved route BEFORE loading initial state
    await this.handleUnsavedRoute();

    // Load saved state
    await this.loadInitialState();

    this.isInitialized = true;
    console.log('✅ App initialization complete');

  } catch (error) {
    console.error('❌ App initialization failed:', error);
    alert('Failed to initialize application. Please refresh the page.');
  }
}

// NEW: Handle unsaved route restoration
async handleUnsavedRoute() {
  try {
    const backupData = this.controllers.state.checkForUnsavedRoute();
    
    if (backupData) {
      const success = await this.showRestoreDialog(backupData);
      
      if (success) {
        console.log('✅ Route restoration completed');
      } else {
        console.log('🗑️ User chose to discard backup or restoration failed');
      }
    }
  } catch (error) {
    console.error('❌ Error handling unsaved route:', error);
    this.controllers.state.clearRouteBackup();
  }
}

// NEW: Show enhanced restore dialog
async showRestoreDialog(backupData) {
  return new Promise((resolve) => {
    try {
      const backupDate = new Date(backupData.backupTime).toLocaleString();
      const pointCount = backupData.routeData.length;
      const distance = (backupData.totalDistance || 0).toFixed(2);
      const locationPoints = backupData.routeData.filter(p => p.type === 'location').length;
      const photos = backupData.routeData.filter(p => p.type === 'photo').length;
      const notes = backupData.routeData.filter(p => p.type === 'text').length;
      
      // Calculate time since backup
      const backupAge = Date.now() - backupData.backupTime;
      const hoursAgo = Math.floor(backupAge / (1000 * 60 * 60));
      const minutesAgo = Math.floor((backupAge % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeAgoText = '';
      if (hoursAgo > 0) {
        timeAgoText = `${hoursAgo}h ${minutesAgo}m ago`;
      } else {
        timeAgoText = `${minutesAgo}m ago`;
      }

      // Create detailed restore dialog
      const restoreMessage = `🔄 UNSAVED ROUTE FOUND!

📅 Created: ${backupDate}
⏰ Time: ${timeAgoText}

📊 Route Details:
📏 Distance: ${distance} km
📍 GPS Points: ${locationPoints}
📷 Photos: ${photos}
📝 Notes: ${notes}
📋 Total Data: ${pointCount} entries

This route was not saved before the app was closed.

Would you like to restore it?

✅ OK = Restore and continue route
❌ Cancel = Start fresh (data will be lost)`;

      const shouldRestore = confirm(restoreMessage);
      
      if (shouldRestore) {
        console.log('👤 User chose to restore route');
        
        const success = this.controllers.state.restoreFromBackup(backupData);
        
        if (success) {
          // Show success message with action options
          this.showRestoreSuccessDialog(backupData);
          resolve(true);
        } else {
          this.showError('❌ Failed to restore route. Starting fresh.');
          this.controllers.state.clearRouteBackup();
          resolve(false);
        }
      } else {
        // User chose to start fresh
        console.log('👤 User chose to start fresh');
        
        // Double-check with warning about data loss
        const confirmDiscard = confirm(`⚠️ Are you sure you want to discard this route?

This will permanently delete:
- ${distance} km of tracked distance
- ${locationPoints} GPS points
- ${photos} photos
- ${notes} notes

This action cannot be undone!`);
        
        if (confirmDiscard) {
          this.controllers.state.clearRouteBackup();
          this.showSuccessMessage('🗑️ Route data discarded. Starting fresh.');
          resolve(false);
        } else {
          // User changed their mind, try restore again
          console.log('👤 User changed mind, attempting restore...');
          const success = this.controllers.state.restoreFromBackup(backupData);
          if (success) {
            this.showRestoreSuccessDialog(backupData);
            resolve(true);
          } else {
            this.showError('❌ Failed to restore route.');
            resolve(false);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in restore dialog:', error);
      this.showError('❌ Error during route restoration.');
      this.controllers.state.clearRouteBackup();
      resolve(false);
    }
  });
}

// NEW: Show restore success dialog with options
showRestoreSuccessDialog(backupData) {
  const distance = (backupData.totalDistance || 0).toFixed(2);
  const pointCount = backupData.routeData.filter(p => p.type === 'location').length;
  
  const successMessage = `✅ Route restored successfully!

📏 ${distance} km and ${pointCount} GPS points recovered

What would you like to do next?

🚀 CONTINUE = Resume tracking from where you left off
💾 SAVE = Save this route now
👁️ VIEW = View route on map

Click OK to continue, or check the route on the map.`;

  // Show success message
  this.showSuccessMessage('✅ Route restored successfully!');
  
  // Give user options
  setTimeout(() => {
    const action = prompt(`Route restored! What next?\n\nType:\n• "continue" to resume tracking\n• "save" to save route now\n• "view" to view on map\n• or just click Cancel to review`);
    
    if (action) {
      const actionLower = action.toLowerCase().trim();
      
      switch (actionLower) {
        case 'continue':
        case 'c':
        case 'resume':
          this.continueRestoredRoute();
          break;
        case 'save':
        case 's':
          this.saveRestoredRoute();
          break;
        case 'view':
        case 'v':
        case 'map':
          this.viewRestoredRoute();
          break;
        default:
          console.log('👤 User chose to review route manually');
      }
    }
  }, 2000);
}

// NEW: Continue tracking from restored route
continueRestoredRoute() {
  try {
    console.log('🚀 Continuing restored route...');
    
    // Update tracking state but don't auto-start
    const trackingController = this.controllers.tracking;
    if (trackingController) {
      // Don't automatically start tracking, just prepare the UI
      trackingController.updateTrackingButtons();
      this.showSuccessMessage('🚀 Ready to continue tracking! Click ▶ to resume.');
    }
  } catch (error) {
    console.error('❌ Failed to prepare continued tracking:', error);
    this.showError('❌ Failed to prepare tracking continuation.');
  }
}

// NEW: Save restored route
async saveRestoredRoute() {
  try {
    console.log('💾 Saving restored route...');
    
    const trackingController = this.controllers.tracking;
    if (trackingController && typeof trackingController.saveRoute === 'function') {
      await trackingController.saveRoute();
    } else {
      // Fallback manual save
      const routeName = prompt('Enter a name for this restored route:') || `Restored Route ${new Date().toLocaleDateString()}`;
      await this.controllers.state.saveSession(routeName);
      this.showSuccessMessage(`✅ Route saved as "${routeName}"`);
    }
  } catch (error) {
    console.error('❌ Failed to save restored route:', error);
    this.showError('❌ Failed to save route: ' + error.message);
  }
}

// NEW: View restored route on map
viewRestoredRoute() {
  try {
    console.log('👁️ Viewing restored route on map...');
    
    const mapController = this.controllers.map;
    if (mapController) {
      // The route should already be redrawn by restoreFromBackup
      // Just ensure map is focused on the route
      this.showSuccessMessage('👁️ Route displayed on map');
    }
  } catch (error) {
    console.error('❌ Failed to view route on map:', error);
    this.showError('❌ Failed to display route on map.');
  }
}

// UPDATED: Enhanced success message method
showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 25px;
    z-index: 9999;
    font-size: 16px;
    font-weight: 500;
    box-shadow: 0 6px 25px rgba(76, 175, 80, 0.4);
    animation: slideDown 0.4s ease;
    max-width: 80%;
    text-align: center;
  `;

  // Add CSS animation if not already added
  if (!document.getElementById('successMessageCSS')) {
    const style = document.createElement('style');
    style.id = 'successMessageCSS';
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translate(-50%, -100%);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(successDiv);
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.remove();
    }
  }, 4000);
}

// UPDATED: Enhanced error message method
showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 25px;
    z-index: 9999;
    font-size: 16px;
    font-weight: 500;
    box-shadow: 0 6px 25px rgba(220, 53, 69, 0.4);
    animation: slideDown 0.4s ease;
    max-width: 80%;
    text-align: center;
  `;

  document.body.appendChild(errorDiv);
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

// ... rest of your existing methods stay the same ...

  // NEW: Setup main event listeners for tracking buttons
  setupMainEventListeners() {
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        try {
          console.log('🎯 Start button clicked');
          await this.controllers.tracking.start();
        } catch (error) {
          console.error('Failed to start tracking:', error);
          alert('Failed to start tracking: ' + error.message);
        }
      });
    }

    // Pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        console.log('⏸️ Pause button clicked');
        this.controllers.tracking.togglePause();
      });
    }

    // Stop button
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        console.log('⏹️ Stop button clicked');
        this.controllers.tracking.stop();
      });
    }

    console.log('✅ Main event listeners set up');
  }

  setupControllerDependencies() {
    this.controllers.tracking.setDependencies({
      timer: this.controllers.timer,
      map: this.controllers.map,
      media: this.controllers.media
    });

    this.controllers.export.setDependencies({
      map: this.controllers.map,
      accessibility: this.controllers.accessibility
    });

    this.controllers.compass.setDependencies({
      map: this.controllers.map
    });
  }

  async initializeControllers() {
    const initPromises = Object.entries(this.controllers).map(async ([name, controller]) => {
      try {
        if (typeof controller.initialize === 'function') {
          await controller.initialize();
          console.log(`✅ ${name} controller initialized`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize ${name} controller:`, error);
        // Don't throw - let other controllers initialize
      }
    });

    await Promise.all(initPromises);
  }

  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason);
      event.preventDefault();
    });
  }

  async loadInitialState() {
    try {
      const backup = localStorage.getItem('route_backup');
      if (backup) {
        const shouldRestore = confirm('Unsaved route found! Would you like to restore it?');
        if (shouldRestore) {
          console.log('✅ Restored from backup');
        } else {
          localStorage.removeItem('route_backup');
        }
      }

      if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
      }

    } catch (error) {
      console.error('Failed to load initial state:', error);
    }
  }

  handleError(error) {
    console.error('App error:', error);
    
    const isCritical = error instanceof TypeError || 
                      error instanceof ReferenceError ||
                      error.message?.includes('Firebase') ||
                      error.message?.includes('geolocation');

    if (isCritical) {
      this.showError('A critical error occurred. Some features may not work properly.');
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  getController(name) {
    return this.controllers[name];
  }
}

// Global app instance
let app = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM loaded, initializing app...');
  app = new AccessNatureApp();
  await app.initialize();
  window.AccessNatureApp = app;
});

// Global functions for HTML onclick handlers
window.openAccessibilityForm = (callback) => {
  console.log('🔧 Opening accessibility form');
  app?.getController('accessibility')?.open(callback);
};

window.closeAccessibilityForm = () => {
  console.log('🔧 Closing accessibility form');
  app?.getController('accessibility')?.close();
};

window.addTextNote = () => {
  console.log('📝 Adding text note');
  app?.getController('media')?.addTextNote();
};

window.showRouteDataOnMap = () => {
  console.log('🗺️ Showing route data on map');
  const routeData = app?.getController('state')?.getRouteData();
  app?.getController('map')?.showRouteData(routeData);
};

window.togglePanel = (panelId) => {
  console.log('📱 Toggling panel:', panelId);
  app?.getController('navigation')?.togglePanel(panelId);
};

window.showStorageMonitor = () => {
  console.log('💾 Showing storage monitor');
  app?.getController('navigation')?.showStorageMonitor();
};

window.triggerImport = () => {
  console.log('📥 Triggering import');
  app?.getController('export')?.triggerImport();
};

window.confirmAndResetApp = () => {
  console.log('🔄 Confirming app reset');
  if (confirm('Reset everything?')) {
    app?.getController('state')?.clearAllAppData();
    location.reload();
  }
};

// Add this to your existing global functions in main.js
window.loadMyTrailGuides = () => {
  console.log('🌐 Global loadMyTrailGuides called');
  const app = window.AccessNatureApp;
  const auth = app?.getController('auth');
  
  if (auth && typeof auth.loadMyTrailGuides === 'function') {
    auth.loadMyTrailGuides();
  } else {
    console.error('Auth controller or method not available');
    alert('Auth controller not available. Please refresh the page.');
  }
};

// Add these to your existing global functions
window.loadMyTrailGuides = () => app?.getController('auth')?.loadMyTrailGuides();
window.viewMyTrailGuide = (guideId) => app?.getController('auth')?.viewTrailGuide(guideId);
window.toggleGuideVisibility = (guideId, makePublic) => app?.getController('auth')?.toggleTrailGuideVisibility(guideId, makePublic);
window.deleteTrailGuide = (guideId) => app?.getController('auth')?.deleteTrailGuide(guideId);

export { AccessNatureApp };