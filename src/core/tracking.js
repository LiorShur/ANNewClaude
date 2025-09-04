// GPS tracking with proper save prompt
import { haversineDistance } from '../utils/calculations.js';

export class TrackingController {
  constructor(appState) {
    this.appState = appState;
    this.watchId = null;
    this.isTracking = false;
    this.isPaused = false;
    this.dependencies = {};
  }

  setDependencies(deps) {
    this.dependencies = deps;
  }

  async start() {
    if (this.isTracking) return false;

    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported by this browser');
    }

    console.log('🚀 Starting GPS tracking...');

    // Clear any previous route data
    this.appState.clearRouteData();
    this.appState.setStartTime(Date.now());

    this.isTracking = true;
    this.isPaused = false;
    this.appState.setTrackingState(true);

    // Start GPS watch
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );

    // Start timer
    if (this.dependencies.timer) {
      this.dependencies.timer.start();
    }

    this.updateTrackingButtons();
    console.log('✅ GPS tracking started successfully');
    return true;
  }

  stop() {
    if (!this.isTracking) {
      console.warn('Tracking not active');
      return false;
    }

    console.log('🛑 Stopping GPS tracking...');

    // Stop GPS watch
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Stop timer
    if (this.dependencies.timer) {
      this.dependencies.timer.stop();
    }

    this.isTracking = false;
    this.isPaused = false;
    this.appState.setTrackingState(false);
    this.updateTrackingButtons();

    // THIS IS THE KEY FIX: Always prompt for save when stopping
    this.promptForSave();

    console.log('✅ GPS tracking stopped');
    return true;
  }

  togglePause() {
    if (!this.isTracking) {
      console.warn('Cannot pause - tracking not active');
      return false;
    }

    if (this.isPaused) {
      // Resume
      console.log('▶️ Resuming tracking...');
      this.isPaused = false;
      
      if (this.dependencies.timer) {
        this.dependencies.timer.resume();
      }

      // Restart GPS watch
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000
        }
      );

    } else {
      // Pause
      console.log('⏸️ Pausing tracking...');
      this.isPaused = true;
      
      if (this.dependencies.timer) {
        this.dependencies.timer.pause();
      }

      // Stop GPS watch but keep tracking state
      if (this.watchId) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    }

    this.appState.setTrackingState(this.isTracking, this.isPaused);
    this.updateTrackingButtons();
    return true;
  }

  handlePositionUpdate(position) {
    if (!this.isTracking || this.isPaused) return;

    const { latitude, longitude, accuracy } = position.coords;
    
    // Filter out inaccurate readings
    if (accuracy > 100) {
      console.warn(`GPS accuracy too low: ${accuracy}m`);
      return;
    }

    const currentCoords = { lat: latitude, lng: longitude };
    const lastCoords = this.appState.getLastCoords();

    // Calculate distance if we have a previous point
    if (lastCoords) {
      const distance = haversineDistance(lastCoords, currentCoords);
      
      // Ignore micro-movements (less than 3 meters)
      if (distance < 0.003) return;

      // Update total distance
      const newTotal = this.appState.getTotalDistance() + distance;
      this.appState.updateDistance(newTotal);
      this.updateDistanceDisplay(newTotal);

      // Draw route segment on map
      if (this.dependencies.map) {
        this.dependencies.map.addRouteSegment(lastCoords, currentCoords);
      }
    }

    // Add GPS point to route data
    this.appState.addRoutePoint({
      type: 'location',
      coords: currentCoords,
      timestamp: Date.now(),
      accuracy: accuracy
    });

    this.appState.addPathPoint(currentCoords);

    // Update map marker
    if (this.dependencies.map) {
      this.dependencies.map.updateMarkerPosition(currentCoords);
    }

    console.log(`📍 GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(1)}m)`);
  }

  handlePositionError(error) {
    console.error('🚨 GPS error:', error);
    
    let errorMessage = 'GPS error: ';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage += 'Location permission denied. Please enable location access and try again.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage += 'Location information unavailable. Please check your GPS settings.';
        break;
      case error.TIMEOUT:
        errorMessage += 'Location request timed out. Please try again.';
        break;
      default:
        errorMessage += 'An unknown error occurred.';
        break;
    }

    alert(errorMessage);

    if (error.code === error.PERMISSION_DENIED) {
      this.stop(); // Stop tracking if permission denied
    }
  }

  updateTrackingButtons() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (startBtn) {
      startBtn.disabled = this.isTracking;
      startBtn.style.opacity = this.isTracking ? '0.5' : '1';
    }

    if (pauseBtn) {
      pauseBtn.disabled = !this.isTracking;
      pauseBtn.style.opacity = this.isTracking ? '1' : '0.5';
      
      // Update pause button text/icon based on state
      if (this.isPaused) {
        pauseBtn.innerHTML = '▶'; // Resume icon
        pauseBtn.title = 'Resume Tracking';
      } else {
        pauseBtn.innerHTML = '⏸'; // Pause icon
        pauseBtn.title = 'Pause Tracking';
      }
    }

    if (stopBtn) {
      stopBtn.disabled = !this.isTracking;
      stopBtn.style.opacity = this.isTracking ? '1' : '0.5';
    }
  }

  updateDistanceDisplay(distance) {
    const distanceElement = document.getElementById('distance');
    if (distanceElement) {
      if (distance < 1) {
        distanceElement.textContent = `${(distance * 1000).toFixed(0)} m`;
      } else {
        distanceElement.textContent = `${distance.toFixed(2)} km`;
      }
    }
  }

  // FIXED: Enhanced save prompt with better UI
  promptForSave() {
    const routeData = this.appState.getRouteData();
    const totalDistance = this.appState.getTotalDistance();
    const elapsedTime = this.appState.getElapsedTime();
    
    // Only prompt if we actually have route data
    if (!routeData || routeData.length === 0) {
      console.log('No route data to save');
      return;
    }

    const locationPoints = routeData.filter(point => point.type === 'location').length;
    const photos = routeData.filter(point => point.type === 'photo').length;
    const notes = routeData.filter(point => point.type === 'text').length;

    // Create a detailed save dialog
    const routeStats = `
Route Summary:
📍 GPS Points: ${locationPoints}
📏 Distance: ${totalDistance.toFixed(2)} km
⏱️ Duration: ${this.formatTime(elapsedTime)}
📷 Photos: ${photos}
📝 Notes: ${notes}

Would you like to save this route?`;

    const wantsToSave = confirm(routeStats);
    
    if (wantsToSave) {
      this.saveRoute();
    } else {
      // Ask if they want to discard
      const confirmDiscard = confirm('⚠️ Are you sure you want to discard this route? All data will be lost!');
      if (confirmDiscard) {
        this.discardRoute();
      } else {
        // Give them another chance to save
        this.saveRoute();
      }
    }
  }

  async saveRoute() {
    try {
      const defaultName = `Route ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      
      let routeName = prompt('Enter a name for this route:', defaultName);
      
      // If they cancelled the name dialog, ask if they want to use default
      if (routeName === null) {
        const useDefault = confirm('Use default name "' + defaultName + '"?');
        routeName = useDefault ? defaultName : null;
      }

      // If they still don't want to name it, don't save
      if (!routeName) {
        console.log('Route save cancelled by user');
        return;
      }

      // Clean up the name
      routeName = routeName.trim() || defaultName;

      const savedSession = await this.appState.saveSession(routeName);
      
      // Clear route data after saving
      this.appState.clearRouteData();
      
      // Show success message
      this.showSuccessMessage(`✅ "${routeName}" saved successfully!`);
      
      // Check if user is logged in and offer cloud save
      const authController = window.AccessNatureApp?.getController('auth');
      if (authController?.isAuthenticated()) {
        const saveToCloud = confirm('Route saved locally! Would you also like to save it to the cloud?');
        if (saveToCloud) {
          await authController.saveCurrentRouteToCloud();
        }
      }

      console.log('✅ Route saved:', savedSession);
      
    } catch (error) {
      console.error('❌ Failed to save route:', error);
      alert('Failed to save route: ' + error.message);
    }
  }

  discardRoute() {
    this.appState.clearRouteData();
    this.showSuccessMessage('Route discarded');
    console.log('🗑️ Route data discarded');
  }

  showSuccessMessage(message) {
    // Create and show success notification
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
    `;

    // Add animation
    const style = document.createElement('style');
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

    document.body.appendChild(successDiv);
    
    // Remove after 4 seconds
    setTimeout(() => {
      successDiv.style.animation = 'slideDown 0.4s ease reverse';
      setTimeout(() => {
        successDiv.remove();
        style.remove();
      }, 400);
    }, 4000);
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Getters
  isTrackingActive() {
    return this.isTracking;
  }

  isPausedState() {
    return this.isPaused;
  }

  getTrackingStats() {
    return {
      isTracking: this.isTracking,
      isPaused: this.isPaused,
      totalDistance: this.appState.getTotalDistance(),
      elapsedTime: this.appState.getElapsedTime(),
      pointCount: this.appState.getRouteData().length
    };
  }

  cleanup() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    if (this.dependencies.timer) {
      this.dependencies.timer.stop();
    }
    
    this.isTracking = false;
    this.isPaused = false;
  }
}