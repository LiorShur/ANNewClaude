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

      // Set up the main UI event listeners - THIS IS KEY!
      this.setupMainEventListeners();

      // Set up error handling
      this.setupErrorHandling();

      // Load saved state
      await this.loadInitialState();

      this.isInitialized = true;
      console.log('✅ App initialization complete');

    } catch (error) {
      console.error('❌ App initialization failed:', error);
      alert('Failed to initialize application. Please refresh the page.');
    }
  }

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

export { AccessNatureApp };