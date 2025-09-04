// Simple storage management
export class AppState {
  constructor() {
    this.routeData = [];
    this.totalDistance = 0;
    this.elapsedTime = 0;
    this.isTracking = false;
    this.startTime = null;
    this.lastCoords = null;
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

  clearRouteData() {
    this.routeData = [];
    this.totalDistance = 0;
    this.elapsedTime = 0;
    this.lastCoords = null;
  }

  updateDistance(distance) {
    this.totalDistance = distance;
  }

  getTotalDistance() {
    return this.totalDistance;
  }

  setTrackingState(isTracking) {
    this.isTracking = isTracking;
  }

  getTrackingState() {
    return { isTracking: this.isTracking };
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

  addPathPoint(coords) {
    this.lastCoords = coords;
  }

  getLastCoords() {
    return this.lastCoords;
  }

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
    return session;
  }

  getSessions() {
    try {
      return JSON.parse(localStorage.getItem('sessions') || '[]');
    } catch {
      return [];
    }
  }

  autoSave() {
    try {
      const backup = {
        routeData: this.routeData,
        totalDistance: this.totalDistance,
        elapsedTime: this.elapsedTime,
        timestamp: Date.now()
      };
      localStorage.setItem('route_backup', JSON.stringify(backup));
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
}