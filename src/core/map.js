// Map controller
export class MapController {
  constructor() {
    this.map = null;
    this.marker = null;
    this.routePolylines = [];
  }

  async initialize() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('Map element not found');
    }

    this.map = L.map('map').setView([32.0853, 34.7818], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.marker = L.marker([32.0853, 34.7818])
      .addTo(this.map)
      .bindPopup("Current Location");

    await this.getCurrentLocation();
  }

  async getCurrentLocation() {
    if (!navigator.geolocation) return;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.map.setView([userLocation.lat, userLocation.lng], 17);
          this.marker.setLatLng([userLocation.lat, userLocation.lng]);
          resolve(userLocation);
        },
        (error) => {
          console.warn('Geolocation failed:', error);
          resolve(null);
        }
      );
    });
  }

  updateMarkerPosition(coords) {
    if (!this.marker || !coords) return;
    this.marker.setLatLng([coords.lat, coords.lng]);
    this.map.panTo([coords.lat, coords.lng]);
  }

  addRouteSegment(startCoords, endCoords) {
    if (!startCoords || !endCoords) return;

    const polyline = L.polyline([
      [startCoords.lat, startCoords.lng], 
      [endCoords.lat, endCoords.lng]
    ], {
      color: '#4CAF50',
      weight: 4,
      opacity: 0.8
    }).addTo(this.map);

    this.routePolylines.push(polyline);
    return polyline;
  }

  showRouteData(routeData) {
    if (!routeData || routeData.length === 0) {
      alert('No route data to display');
      return;
    }

    this.clearRouteDisplay();
    const bounds = L.latLngBounds([]);

    routeData.forEach(entry => {
      if (!entry.coords) return;
      bounds.extend([entry.coords.lat, entry.coords.lng]);

      if (entry.type === 'photo') {
        const icon = L.divIcon({
          html: '📷',
          iconSize: [30, 30],
          className: 'custom-div-icon'
        });

        L.marker([entry.coords.lat, entry.coords.lng], { icon })
          .addTo(this.map)
          .bindPopup(`<img src="${entry.content}" style="width:200px">`);
      } else if (entry.type === 'text') {
        const icon = L.divIcon({
          html: '📝',
          iconSize: [30, 30],
          className: 'custom-div-icon'
        });

        L.marker([entry.coords.lat, entry.coords.lng], { icon })
          .addTo(this.map)
          .bindPopup(entry.content);
      }
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds);
    }
  }

  clearRouteDisplay() {
    this.routePolylines.forEach(polyline => {
      this.map.removeLayer(polyline);
    });
    this.routePolylines = [];
  }

  setRotation(angle) {
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      mapContainer.style.transform = `rotate(${-angle}deg)`;
    }
  }

  resetRotation() {
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      mapContainer.style.transform = 'rotate(0deg)';
    }
  }
}