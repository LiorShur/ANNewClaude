// Simple storage management with enhanced backup/restore
export class AppState {
  constructor() {
    this.routeData = [];
    this.pathPoints = []; // Add this for map redrawing
    this.totalDistance = 0;
    this.elapsedTime = 0;
    this.isTracking = false;
    this.isPaused = false; // Add this for pause state
    this.startTime = null;
    this.lastCoords = null;
    this.lastBackupTime = 0; // Add this for backup timing
    this.backupInterval = null; // Add this for auto backup
  }

  addRoutePoint(entry) {
    this.routeData.push({
      ...entry,
      timestamp: entry.timestamp || Date.now()
    });
    this.autoSave();
  }

  getRouteData() {
    return [...this.routeData];
  }

  // UPDATED: Enhanced clear with backup cleanup
  clearRouteData() {
    this.routeData = [];
    this.pathPoints = [];
    this.totalDistance = 0;
    this.elapsedTime = 0;
    this.lastCoords = null;
    this.isTracking = false;
    this.isPaused = false;
    this.stopAutoBackup();
    this.clearRouteBackup();
  }

  updateDistance(distance) {
    this.totalDistance = distance;
  }

  getTotalDistance() {
    return this.totalDistance;
  }

  // UPDATED: Enhanced tracking state with auto backup
  setTrackingState(isTracking, isPaused = false) {
    this.isTracking = isTracking;
    this.isPaused = isPaused;
    
    if (isTracking && !isPaused) {
      this.startAutoBackup();
    } else {
      this.stopAutoBackup();
    }
  }

  getTrackingState() {
    return { 
      isTracking: this.isTracking,
      isPaused: this.isPaused 
    };
  }

  setElapsedTime(time) {
    this.elapsedTime = time;
  }

  getElapsedTime() {
    return this.elapsedTime;
  }

  setStartTime(time) {
    this.startTime = time;
  }

  getStartTime() {
    return this.startTime;
  }

  // UPDATED: Enhanced to track path points for map redrawing
  addPathPoint(coords) {
    this.lastCoords = coords;
    this.pathPoints.push(coords);
  }

  getLastCoords() {
    return this.lastCoords;
  }

  // UPDATED: Clear backup when route is saved
  async saveSession(name) {
    if (!name || this.routeData.length === 0) {
      throw new Error('Invalid session data');
    }

    const session = {
      id: Date.now(),
      name,
      date: new Date().toISOString(),
      totalDistance: this.totalDistance,
      elapsedTime: this.elapsedTime,
      data: [...this.routeData]
    };

    const sessions = this.getSessions();
    sessions.push(session);
    localStorage.setItem('sessions', JSON.stringify(sessions));
    
    // Clear backup after successful save
    this.clearRouteBackup();
    
    return session;
  }

  getSessions() {
    try {
      return JSON.parse(localStorage.getItem('sessions') || '[]');
    } catch {
      return [];
    }
  }

  // UPDATED: Enhanced auto-save with metadata
  autoSave() {
    try {
      const backup = {
        routeData: this.routeData,
        pathPoints: this.pathPoints,
        totalDistance: this.totalDistance,
        elapsedTime: this.elapsedTime,
        startTime: this.startTime,
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        backupTime: Date.now(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      };
      localStorage.setItem('route_backup', JSON.stringify(backup));
      this.lastBackupTime = Date.now();
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  async clearAllSessions() {
    localStorage.removeItem('sessions');
  }

  async clearAllAppData() {
    localStorage.clear();
    this.clearRouteData();
  }

  async reset() {
    this.clearRouteData();
    this.setTrackingState(false);
  }

  // NEW: Auto backup system
  startAutoBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Backup every 30 seconds during tracking
    this.backupInterval = setInterval(() => {
      if (this.isTracking && this.routeData.length > 0) {
        this.autoSave();
        console.log(`💾 Auto backup: ${this.routeData.length} points, ${this.totalDistance.toFixed(2)} km`);
      }
    }, 30000);

    console.log('🔄 Auto backup started');
  }

  stopAutoBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  // NEW: Check for unsaved route on app load
  checkForUnsavedRoute() {
    try {
      const backup = localStorage.getItem('route_backup');
      if (!backup) return null;

      const backupData = JSON.parse(backup);
      
      // Check if backup is recent (within last 24 hours)
      const backupAge = Date.now() - backupData.backupTime;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (backupAge > maxAge) {
        console.log('⏰ Route backup too old, removing...');
        localStorage.removeItem('route_backup');
        return null;
      }

      // Check if backup has meaningful data
      if (!backupData.routeData || backupData.routeData.length === 0) {
        console.log('📭 Route backup empty, removing...');
        localStorage.removeItem('route_backup');
        return null;
      }

      console.log(`🔍 Found route backup: ${backupData.routeData.length} points, ${backupData.totalDistance?.toFixed(2) || 0} km`);
      return backupData;
      
    } catch (error) {
      console.error('❌ Failed to check for unsaved route:', error);
      localStorage.removeItem('route_backup'); // Remove corrupted backup
      return null;
    }
  }

  // NEW: Restore route from backup
  restoreFromBackup(backupData) {
    try {
      this.routeData = backupData.routeData || [];
      this.pathPoints = backupData.pathPoints || [];
      this.totalDistance = backupData.totalDistance || 0;
      this.elapsedTime = backupData.elapsedTime || 0;
      this.startTime = backupData.startTime;
      this.lastCoords = this.pathPoints.length > 0 ? this.pathPoints[this.pathPoints.length - 1] : null;
      this.isTracking = false; // Don't auto-resume tracking
      this.isPaused = false;

      console.log(`✅ Route restored: ${this.routeData.length} points, ${this.totalDistance.toFixed(2)} km`);
      
      // Update UI displays
      this.updateDistanceDisplay();
      this.updateTimerDisplay();
      
      // Restore route on map if available
      this.redrawRouteOnMap();
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to restore route from backup:', error);
      return false;
    }
  }

  // NEW: Update distance display
  updateDistanceDisplay() {
    const distanceElement = document.getElementById('distance');
    if (distanceElement) {
      if (this.totalDistance < 1) {
        distanceElement.textContent = `${(this.totalDistance * 1000).toFixed(0)} m`;
      } else {
        distanceElement.textContent = `${this.totalDistance.toFixed(2)} km`;
      }
    }
  }

  // NEW: Update timer display
  updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    if (timerElement && this.startTime) {
      const elapsed = this.elapsedTime || (Date.now() - this.startTime);
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // NEW: Redraw route on map
  redrawRouteOnMap() {
    try {
      // Get map controller
      const app = window.AccessNatureApp;
      const mapController = app?.getController('map');
      
      if (mapController && this.pathPoints.length > 0) {
        console.log('🗺️ Redrawing route on map...');
        
        // Clear existing route if method exists
        if (typeof mapController.clearRoute === 'function') {
          mapController.clearRoute();
        }
        
        // Redraw route segments
        for (let i = 1; i < this.pathPoints.length; i++) {
          if (typeof mapController.addRouteSegment === 'function') {
            mapController.addRouteSegment(this.pathPoints[i-1], this.pathPoints[i]);
          }
        }
        
        // Update marker to last position
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        if (typeof mapController.updateMarkerPosition === 'function') {
          mapController.updateMarkerPosition(lastPoint);
        }
        
        console.log('✅ Route redrawn on map');
      }
    } catch (error) {
      console.error('❌ Failed to redraw route on map:', error);
    }
  }

  // NEW: Clear backup when route is saved
  clearRouteBackup() {
    localStorage.removeItem('route_backup');
    this.stopAutoBackup();
    console.log('🧹 Route backup cleared');
  }
}