// Landing page controller
import { auth, db } from '../firebase-setup.js';

class LandingPageController {
  constructor() {
    this.authController = null;
    this.currentFilters = {};
    this.currentSearch = '';
    this.lastVisible = null;
    this.isLoading = false;
  }

async initialize() {
  try {
    console.log('Initializing landing page...');
    
    this.setupEventListeners();
    await this.updateLandingAuthStatus();
    
    // Load community data
    await this.loadCommunityStats();
    await this.loadFeaturedTrails();
    
    // Load user stats (now async)
    await this.updateUserStats();
    
    console.log('Landing page initialized');
    
  } catch (error) {
    console.error('Landing page initialization failed:', error);
  }
}

  setupEventListeners() {
    // Quick search
    const quickSearchInput = document.getElementById('quickSearch');
    if (quickSearchInput) {
      quickSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.quickSearch();
        }
      });
      window.viewTrailGuide = (guideId) => this.viewTrailGuide(guideId);
    }

    // Make functions global
    window.openTrailBrowser = () => this.openTrailBrowser();
    window.closeTrailBrowser = () => this.closeTrailBrowser();
    window.openTracker = () => this.openTracker();
    window.quickSearch = () => this.quickSearch();
    window.searchTrails = () => this.searchTrails();
    window.applyFilters = () => this.applyFilters();
    window.loadMoreResults = () => this.loadMoreResults();
    window.loadMoreFeatured = () => this.loadMoreFeatured();
    window.viewTrailGuide = (guideId) => this.viewTrailGuide(guideId);
    window.loadMyTrailGuides = () => this.loadMyTrailGuides();
    
    // Info functions
    window.showAbout = () => this.showAbout();
    window.showPrivacy = () => this.showPrivacy();
    window.showContact = () => this.showContact();
    window.showHelp = () => this.showHelp();
  }

  // Navigation Functions
  openTrailBrowser() {
    const modal = document.getElementById('trailBrowserModal');
    if (modal) {
      modal.classList.remove('hidden');
      this.searchTrails(); // Load initial results
    }
  }

  closeTrailBrowser() {
    const modal = document.getElementById('trailBrowserModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  openTracker() {
    // Redirect to main tracker app
    window.location.href = 'index.html';
  }

  // Search Functions
  async quickSearch() {
    const searchInput = document.getElementById('quickSearch');
    const searchTerm = searchInput?.value?.trim();
    
    if (!searchTerm) {
      alert('Please enter a search term');
      return;
    }

    this.currentSearch = searchTerm;
    this.openTrailBrowser();
  }

// UPDATED: Search with better error handling
async searchTrails() {
  if (this.isLoading) return;
  
  this.isLoading = true;
  this.showLoading('trailResults');
  
  try {
    const searchInput = document.getElementById('trailSearch');
    const searchTerm = searchInput?.value?.trim() || this.currentSearch;
    
    console.log('Searching trails:', searchTerm || 'all trails');
    
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    // Simple query without orderBy
    let guidesQuery = query(
      collection(db, 'trail_guides'),
      where('isPublic', '==', true)
    );
    
    const querySnapshot = await getDocs(guidesQuery);
    const guides = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      
      // Apply text search filter on client side
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = data.routeName?.toLowerCase().includes(searchLower);
        const locationMatch = data.accessibility?.location?.toLowerCase().includes(searchLower);
        const authorMatch = data.userEmail?.toLowerCase().includes(searchLower);
        
        if (!nameMatch && !locationMatch && !authorMatch) {
          return; // Skip this result
        }
      }
      
      // Apply other filters on client side
      if (this.currentFilters.wheelchairAccess && 
          data.accessibility?.wheelchairAccess !== this.currentFilters.wheelchairAccess) {
        return;
      }
      
      if (this.currentFilters.difficulty && 
          data.accessibility?.difficulty !== this.currentFilters.difficulty) {
        return;
      }
      
      if (this.currentFilters.distance) {
        const distance = data.metadata?.totalDistance || 0;
        const [min, max] = this.parseDistanceFilter(this.currentFilters.distance);
        if (distance < min || (max && distance > max)) {
          return;
        }
      }
      
      guides.push({
        id: doc.id,
        ...data
      });
    });
    
    // Sort client-side by creation date (newest first)
    guides.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    
    console.log(`Found ${guides.length} trails matching criteria`);
    this.displayTrailResults(guides);
    this.updateResultsCount(guides.length);
    
  } catch (error) {
    console.error('Search failed:', error);
    
    const resultsContainer = document.getElementById('trailResults');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Search temporarily unavailable</h3>
          <p>Please try again in a moment, or check your connection.</p>
          <button onclick="searchTrails()" class="nav-card-button primary">Retry Search</button>
        </div>
      `;
    }
  } finally {
    this.isLoading = false;
  }
}

  applyFilters() {
    // Collect filter values
    this.currentFilters = {
      wheelchairAccess: document.getElementById('wheelchairFilter')?.value || '',
      difficulty: document.getElementById('difficultyFilter')?.value || '',
      distance: document.getElementById('distanceFilter')?.value || ''
    };
    
    console.log('🎯 Applying filters:', this.currentFilters);
    this.searchTrails();
  }

  displayTrailResults(guides) {
    const resultsContainer = document.getElementById('trailResults');
    if (!resultsContainer) return;
    
    if (guides.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No trails found</h3>
          <p>Try adjusting your search terms or filters</p>
          <button onclick="clearFilters()" class="nav-card-button primary">Clear Filters</button>
        </div>
      `;
      return;
    }
    
    const resultsHTML = guides.map(guide => this.createTrailResultCard(guide)).join('');
    resultsContainer.innerHTML = resultsHTML;
  }

  createTrailResultCard(guide) {
    const date = new Date(guide.generatedAt).toLocaleDateString();
    const accessibility = guide.accessibility || {};
    const metadata = guide.metadata || {};
    const community = guide.community || {};
    
    return `
      <div class="trail-result-card" onclick="viewTrailGuide('${guide.id}')">
        <div class="trail-result-header">
          <div class="trail-result-name">${guide.routeName}</div>
          <div class="trail-result-author">by ${guide.userEmail}</div>
          <div class="trail-result-date">${date}</div>
        </div>
        
        <div class="trail-result-body">
          <div class="trail-result-stats">
            <div class="trail-stat">
              <span class="trail-stat-value">${(metadata.totalDistance || 0).toFixed(1)}</span>
              <span class="trail-stat-label">km</span>
            </div>
            <div class="trail-stat">
              <span class="trail-stat-value">${metadata.locationCount || 0}</span>
              <span class="trail-stat-label">GPS Points</span>
            </div>
          </div>
          
          <div class="trail-accessibility-tags">
            ${accessibility.wheelchairAccess ? `<span class="accessibility-tag">♿ ${accessibility.wheelchairAccess}</span>` : ''}
            ${accessibility.difficulty ? `<span class="accessibility-tag">🥾 ${accessibility.difficulty}</span>` : ''}
            ${accessibility.trailSurface ? `<span class="accessibility-tag">🛤️ ${accessibility.trailSurface}</span>` : ''}
          </div>
          
          <div class="trail-community-stats">
            <span>👁️ ${community.views || 0} views</span>
            <span>📷 ${metadata.photoCount || 0} photos</span>
            <span>📝 ${metadata.noteCount || 0} notes</span>
          </div>
        </div>
      </div>
    `;
  }

  async viewTrailGuide(guideId) {
    try {
      console.log('👁️ Viewing trail guide:', guideId);
      
      // Get trail guide with HTML content
      const authController = window.AccessNatureApp?.getController?.('auth');
      if (authController && typeof authController.getTrailGuide === 'function') {
        const guide = await authController.getTrailGuide(guideId);
        
        if (guide && guide.htmlContent) {
          // Open HTML content in new tab
          const blob = new Blob([guide.htmlContent], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          
          // Clean up URL after delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          alert('Trail guide content not available');
        }
      } else {
        alert('Please sign in to view full trail guides');
      }
      
    } catch (error) {
      console.error('❌ Failed to view trail guide:', error);
      alert('Failed to load trail guide. Please try again.');
    }
  }

  // Stats Functions
// UPDATED: Load community stats without count queries
async loadCommunityStats() {
  try {
    console.log('Loading community stats...');
    
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    // Remove the orderBy to avoid index requirements
    const publicGuidesQuery = query(
      collection(db, 'trail_guides'), 
      where('isPublic', '==', true)
    );
    
    const guidesSnapshot = await getDocs(publicGuidesQuery);
    
    let totalKm = 0;
    let accessibleTrails = 0;
    const uniqueUsers = new Set();
    const publicGuidesCount = guidesSnapshot.size;
    
    guidesSnapshot.forEach(doc => {
      const data = doc.data();
      totalKm += data.metadata?.totalDistance || 0;
      uniqueUsers.add(data.userId);
      
      if (data.accessibility?.wheelchairAccess === 'Fully Accessible') {
        accessibleTrails++;
      }
    });
    
    // Update display with animation
    this.animateNumber('publicGuides', publicGuidesCount);
    this.animateNumber('totalKm', Math.round(totalKm));
    this.animateNumber('accessibleTrails', accessibleTrails);
    this.animateNumber('totalUsers', uniqueUsers.size);
    
    console.log('Community stats loaded successfully');
    
  } catch (error) {
    console.error('Failed to load community stats:', error);
    
    // Set default values if failing
    this.updateElement('publicGuides', '0');
    this.updateElement('totalKm', '0');
    this.updateElement('accessibleTrails', '0');
    this.updateElement('totalUsers', '0');
  }
}

// UPDATED: Load featured trails with better error handling
async loadFeaturedTrails() {
  try {
    console.log('Loading featured trails...');
    
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    // Simple query without orderBy to avoid index issues
    const featuredQuery = query(
      collection(db, 'trail_guides'),
      where('isPublic', '==', true)
    );
    
    const querySnapshot = await getDocs(featuredQuery);
    const featured = [];
    
    querySnapshot.forEach(doc => {
      featured.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort client-side by creation date (newest first)
    featured.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    
    // Take first 6 for featured display
    const featuredToShow = featured.slice(0, 6);
    
    console.log(`Loaded ${featuredToShow.length} featured trails`);
    this.displayFeaturedTrails(featuredToShow);
    
  } catch (error) {
    console.error('Failed to load featured trails:', error);
    this.showFeaturedPlaceholder();
  }
}

  displayFeaturedTrails(trails) {
    const container = document.getElementById('featuredTrails');
    if (!container) return;
    
    if (trails.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <h3>No featured trails yet</h3>
          <p>Be the first to contribute accessible trail guides!</p>
          <button onclick="openTracker()" class="nav-card-button primary">Start Mapping</button>
        </div>
      `;
      return;
    }
    
    const featuredHTML = trails.map(trail => this.createFeaturedTrailCard(trail)).join('');
    container.innerHTML = featuredHTML;
  }

  createFeaturedTrailCard(trail) {
    const accessibility = trail.accessibility || {};
    const metadata = trail.metadata || {};
    const community = trail.community || {};
    
    return `
      <div class="featured-trail">
        <div class="trail-image">🌲</div>
        <div class="trail-info">
          <div class="trail-name">${trail.routeName}</div>
          <div class="trail-meta">
            <span>📍 ${accessibility.location || 'Location not specified'}</span>
            <span>📅 ${new Date(trail.generatedAt).toLocaleDateString()}</span>
          </div>
          <div class="trail-accessibility">
            ${accessibility.wheelchairAccess ? `<span class="accessibility-badge">♿ ${accessibility.wheelchairAccess}</span>` : ''}
            ${accessibility.difficulty ? `<span class="accessibility-badge">🥾 ${accessibility.difficulty}</span>` : ''}
          </div>
          <div class="trail-stats">
            <span>📏 ${(metadata.totalDistance || 0).toFixed(1)} km</span>
            <span>👁️ ${community.views || 0} views</span>
            <span>📷 ${metadata.photoCount || 0} photos</span>
          </div>
          <button class="view-trail-btn" onclick="viewTrailGuide('${trail.id}')">
            View Trail Guide
          </button>
        </div>
      </div>
    `;
  }

  showFeaturedPlaceholder() {
    const container = document.getElementById('featuredTrails');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌲</div>
          <h3>Featured trails coming soon!</h3>
          <p>Help build our community by mapping accessible trails</p>
        </div>
      `;
    }
  }

async updateUserStats() {
  try {
    const authStatus = await this.checkLandingAuth();
    
    if (authStatus.isSignedIn) {
      // User is signed in - load their cloud data
      await this.loadUserCloudStats();
    } else {
      // User not signed in - check localStorage only
      this.loadLocalStats();
    }
  } catch (error) {
    console.error('Failed to update user stats:', error);
    // Fallback to local stats
    this.loadLocalStats();
  }
}

// Add this new method to load cloud stats
async loadUserCloudStats() {
  try {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    const { auth } = await import('../firebase-setup.js');
    
    // Get user's routes from Firebase
    const routesQuery = query(
      collection(db, 'routes'),
      where('userId', '==', auth.currentUser.uid)
    );
    
    const routesSnapshot = await getDocs(routesQuery);
    let totalDistance = 0;
    
    routesSnapshot.forEach(doc => {
      const data = doc.data();
      totalDistance += data.totalDistance || 0;
    });
    
    // Update display
    this.updateElement('totalRoutes', routesSnapshot.size);
    this.updateElement('totalDistance', totalDistance.toFixed(1));
    
    console.log(`User stats: ${routesSnapshot.size} routes, ${totalDistance.toFixed(1)} km`);
    
  } catch (error) {
    console.error('Failed to load cloud stats:', error);
    // Fallback to local stats
    this.loadLocalStats();
  }
}

// Add this method for local stats fallback
loadLocalStats() {
  const totalRoutes = localStorage.getItem('sessions') ? JSON.parse(localStorage.getItem('sessions')).length : 0;
  this.updateElement('totalRoutes', totalRoutes);
  
  let totalDistance = 0;
  try {
    const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    totalDistance = sessions.reduce((sum, session) => sum + (session.totalDistance || 0), 0);
  } catch (error) {
    console.warn('Error calculating total distance:', error);
  }
  
  this.updateElement('totalDistance', totalDistance.toFixed(1));
}

  // Utility Functions
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateResultsCount(count) {
    const element = document.getElementById('resultsCount');
    if (element) {
      element.textContent = `${count} trail${count !== 1 ? 's' : ''} found`;
    }
  }

  showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="loading">
          Loading trails... <span class="loading-spinner">⏳</span>
        </div>
      `;
    }
  }

  showError(message) {
    alert('❌ ' + message);
  }

  // Info Functions
  showAbout() {
    alert(`🌲 About Access Nature

Making outdoor spaces accessible for everyone.

Our mission is to create a comprehensive database of accessible trail information, documented by the community for the community.

Features:
- GPS tracking and route documentation
- Detailed accessibility surveys
- Photo and note sharing
- Community trail guide database
- Export and sharing capabilities

Join us in making nature accessible to all!`);
  }

  // Info Functions (continued)
  showPrivacy() {
    alert(`🔒 Privacy Policy

Access Nature Privacy Commitment:

DATA COLLECTION:
- We only collect data you choose to share
- Route data is stored locally by default
- Cloud sync is optional and user-controlled
- No tracking or analytics without consent

YOUR CONTROL:
- You own all your route data
- Delete data anytime from your device
- Make trail guides public/private as you choose
- Export your data in multiple formats

SHARING:
- Only public trail guides are visible to others
- Personal information is never shared
- Location data is only in routes you publish

SECURITY:
- Data encrypted in transit and at rest
- Firebase security rules protect your data
- Regular security updates and monitoring

Questions? Contact us through the app.`);
  }

  showContact() {
    alert(`📧 Contact Access Nature

Get in touch with our team:

SUPPORT:
- Email: support@accessnature.app
- Response time: 24-48 hours
- Include device info for technical issues

FEEDBACK:
- Feature requests welcome
- Bug reports appreciated
- Accessibility suggestions prioritized

PARTNERSHIPS:
- Trail organizations
- Accessibility advocates
- Technology collaborators

COMMUNITY:
- Join our monthly virtual meetups
- Share your accessibility mapping stories
- Help improve trail documentation

We're here to help make nature accessible!`);
  }

  showHelp() {
    alert(`❓ Access Nature Help

GETTING STARTED:
1. Sign up for cloud sync (optional)
2. Start tracking a trail
3. Take photos and notes along the way
4. Fill out accessibility survey
5. Save and share your trail guide

TRAIL MAPPING TIPS:
- Keep GPS enabled for accurate tracking
- Take photos of key accessibility features
- Note surface types, obstacles, facilities
- Include gradient and width information

SEARCHING TRAILS:
- Use filters for specific accessibility needs
- Browse by location or difficulty
- Read community reviews and ratings
- Download trail guides for offline use

TROUBLESHOOTING:
- Ensure location permissions enabled
- Use strong internet for cloud sync
- Clear browser cache if issues persist
- Contact support for technical problems

Happy trail mapping! 🥾`);
  }

  // Additional utility functions
  async loadMoreResults() {
    // Implement pagination for search results
    console.log('📄 Loading more results...');
    // This would extend the current search with more results
  }

  async loadMoreFeatured() {
    // Load more featured trails
    console.log('⭐ Loading more featured trails...');
    // This would load additional featured trails
  }

  clearFilters() {
    // Clear all filters and search
    document.getElementById('wheelchairFilter').value = '';
    document.getElementById('difficultyFilter').value = '';
    document.getElementById('distanceFilter').value = '';
    document.getElementById('trailSearch').value = '';
    
    this.currentFilters = {};
    this.currentSearch = '';
    this.searchTrails();
  }

  // Make clearFilters available globally
  setupGlobalFunctions() {
    window.clearFilters = () => this.clearFilters();
  }

  // NEW: Animate number changes for better UX
  animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = 0;
    const duration = 2000; // 2 seconds
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutCubic);
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  // NEW: Parse distance filter range
  parseDistanceFilter(distanceFilter) {
    switch (distanceFilter) {
      case '0-2': return [0, 2];
      case '2-5': return [2, 5];
      case '5-10': return [5, 10];
      case '10+': return [10, null];
      default: return [0, null];
    }
  }

  // ADD this debug function to your LandingPageController class
async debugTrailGuides() {
  try {
    console.log('🐛 Debugging trail guides...');
    
    const { collection, getDocs, query, limit } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    // Check ALL trail guides (public and private)
    const allGuidesQuery = query(collection(db, 'trail_guides'), limit(10));
    const allSnapshot = await getDocs(allGuidesQuery);
    
    console.log('📊 Total trail guides in database:', allSnapshot.size);
    
    if (allSnapshot.size > 0) {
      allSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('📄 Trail guide:', {
          id: doc.id,
          name: data.routeName,
          isPublic: data.isPublic,
          userId: data.userId,
          generatedAt: data.generatedAt
        });
      });
      
      // Check specifically for public guides
      const { where } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
      const publicQuery = query(
        collection(db, 'trail_guides'), 
        where('isPublic', '==', true),
        limit(10)
      );
      const publicSnapshot = await getDocs(publicQuery);
      console.log('🌍 Public trail guides:', publicSnapshot.size);
      
    } else {
      console.log('❌ No trail guides found in database');
    }
    
  } catch (error) {
    console.error('🐛 Debug failed:', error);
  }
}

// NEW: View trail guide directly (no auth controller dependency)
async viewTrailGuide(guideId) {
  try {
    console.log('👁️ Viewing trail guide:', guideId);
    
    // Import Firestore functions
    const { doc, getDoc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    // Get the trail guide document
    const guideRef = doc(db, 'trail_guides', guideId);
    const guideSnap = await getDoc(guideRef);
    
    if (!guideSnap.exists()) {
      alert('❌ Trail guide not found');
      return;
    }
    
    const guideData = guideSnap.data();
    
    // Check if it's public or user owns it
    const { auth } = await import('../firebase-setup.js');
    const currentUser = auth.currentUser;
    
    const canView = guideData.isPublic || (currentUser && currentUser.uid === guideData.userId);
    
    if (!canView) {
      alert('❌ This trail guide is private and you don\'t have permission to view it.');
      return;
    }
    
    // Increment view count (only for public guides and if not the owner)
    if (guideData.isPublic && (!currentUser || currentUser.uid !== guideData.userId)) {
      try {
        await updateDoc(guideRef, {
          'community.views': increment(1)
        });
        console.log('📈 View count incremented');
      } catch (error) {
        console.warn('Failed to increment view count:', error);
        // Don't fail the whole operation for this
      }
    }
    
    // Show the HTML content
    if (guideData.htmlContent) {
      this.displayTrailGuideHTML(guideData.htmlContent, guideData.routeName);
    } else {
      alert('❌ Trail guide content not available');
    }
    
  } catch (error) {
    console.error('❌ Failed to view trail guide:', error);
    alert('❌ Failed to load trail guide: ' + error.message);
  }
}

// NEW: Display trail guide HTML in new window
displayTrailGuideHTML(htmlContent, routeName) {
  try {
    // Create blob and open in new tab
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new window/tab
    const newWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    
    if (!newWindow) {
      // Popup blocked, offer download instead
      const downloadConfirm = confirm('Popup blocked! Would you like to download the trail guide instead?');
      if (downloadConfirm) {
        this.downloadTrailGuide(htmlContent, routeName);
      }
    } else {
      // Set window title
      newWindow.document.title = `${routeName} - Trail Guide`;
    }
    
    // Clean up URL after delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
  } catch (error) {
    console.error('❌ Failed to display trail guide:', error);
    alert('❌ Failed to display trail guide: ' + error.message);
  }
}

// NEW: Download trail guide as HTML file
downloadTrailGuide(htmlContent, routeName) {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${routeName.replace(/[^a-z0-9]/gi, '_')}_trail_guide.html`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log('✅ Trail guide downloaded');
    
  } catch (error) {
    console.error('❌ Failed to download trail guide:', error);
    alert('❌ Failed to download trail guide: ' + error.message);
  }
}

// UPDATED: Check authentication status for landing page
async checkLandingAuth() {
  try {
    const { auth } = await import('../firebase-setup.js');
    return {
      isSignedIn: !!auth.currentUser,
      user: auth.currentUser,
      email: auth.currentUser?.email
    };
  } catch (error) {
    console.error('Auth check failed:', error);
    return { isSignedIn: false, user: null, email: null };
  }
}

// ADD this method to LandingPageController
async updateLandingAuthStatus() {
  const authStatus = await this.checkLandingAuth();
  
  const userInfo = document.getElementById('userInfo');
  const authPrompt = document.getElementById('authPrompt');
  const userEmail = document.getElementById('userEmail');
  
  if (authStatus.isSignedIn) {
    userInfo?.classList.remove('hidden');
    authPrompt?.classList.add('hidden');
    if (userEmail) userEmail.textContent = authStatus.email;
  } else {
    userInfo?.classList.add('hidden');
    authPrompt?.classList.remove('hidden');
  }
}

// Call this in your initialize() method
async initialize() {
  try {
    console.log('🏠 Initializing landing page...');
    
    this.setupEventListeners();
    await this.updateLandingAuthStatus(); // Add this line
    await this.loadCommunityStats();
    await this.loadFeaturedTrails();
    this.updateUserStats();
    
    console.log('✅ Landing page initialized');
  } catch (error) {
    console.error('❌ Landing page initialization failed:', error);
  }
}

async loadMyTrailGuides() {
  try {
    console.log('🌐 Loading trail guides from landing page...');
    
    // Check if user is signed in
    const authStatus = await this.checkLandingAuth();
    if (!authStatus.isSignedIn) {
      alert('Please sign in first to view your trail guides');
      return;
    }

    // Import Firestore functions
    const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    const { db, auth } = await import('../firebase-setup.js');
    
    // Query user's trail guides
    const guidesQuery = query(
      collection(db, 'trail_guides'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('generatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(guidesQuery);
    const guides = [];
    
    querySnapshot.forEach(doc => {
      guides.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${guides.length} trail guides`);
    
    if (guides.length === 0) {
      alert('No trail guides found.\n\nTo create trail guides:\n• Record a route in the tracker\n• Save it to cloud\n• Trail guide will be auto-generated');
      return;
    }
    
    this.displayLandingGuides(guides);
    
  } catch (error) {
    console.error('Failed to load trail guides:', error);
    alert('Failed to load trail guides: ' + error.message);
  }
}

// Add this method too
displayLandingGuides(guides) {
  let message = 'Your Trail Guides:\n\n';
  
  guides.forEach((guide, index) => {
    const date = new Date(guide.generatedAt).toLocaleDateString();
    const visibility = guide.isPublic ? 'Public' : 'Private';
    
    message += `${index + 1}. ${guide.routeName} (${visibility})\n`;
    message += `   Created: ${date}\n`;
    if (guide.metadata) {
      message += `   Distance: ${(guide.metadata.totalDistance || 0).toFixed(1)} km\n`;
    }
    message += '\n';
  });

  message += `Select a guide to view (1-${guides.length}), or 0 to cancel:`;
  
  const choice = prompt(message);
  const choiceNum = parseInt(choice);
  
  if (choiceNum >= 1 && choiceNum <= guides.length) {
    this.viewTrailGuide(guides[choiceNum - 1].id);
  }
}
}

// Initialize landing page when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const landingController = new LandingPageController();
  await landingController.initialize();
  landingController.setupGlobalFunctions();
  
  // Make controller available globally
  window.LandingPageController = landingController;
});

export { LandingPageController };