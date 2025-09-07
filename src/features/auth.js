// Authentication controller with beautiful UI
import { auth, db } from '../../firebase-setup.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class AuthController {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.isSavingToCloud = false;     // Add this line
    this.isSelectingRoute = false;    // Add this line
    this.callbacks = {
      onLogin: [],
      onLogout: []
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.setupEventListeners();
      this.setupAuthStateListener();
      this.adjustLayoutForAuth();
      
      this.isInitialized = true;
      console.log('🔥 Auth controller initialized');
      
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
    }
  }

  setupEventListeners() {
    // Show auth modal button
    const showAuthBtn = document.getElementById('showAuthBtn');
    if (showAuthBtn) {
      showAuthBtn.addEventListener('click', () => this.showAuthModal());
    }

    // Login form
    const loginForm = document.querySelector('#loginForm form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Signup form
    const signupForm = document.querySelector('#signupForm form');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    // Google login buttons
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleSignupBtn = document.getElementById('googleSignupBtn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => this.handleGoogleAuth());
    }
    if (googleSignupBtn) {
      googleSignupBtn.addEventListener('click', () => this.handleGoogleAuth());
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Cloud save/load buttons
// Cloud save/load buttons
const saveToCloudBtn = document.getElementById('saveToCloudBtn');
const loadCloudRoutesBtn = document.getElementById('loadCloudRoutesBtn');

if (saveToCloudBtn) {
  saveToCloudBtn.addEventListener('click', () => {
    console.log('☁️ Cloud save button clicked');
    this.saveCurrentRouteToCloud();
  });
}
if (loadCloudRoutesBtn) {
  loadCloudRoutesBtn.addEventListener('click', () => {
    console.log('📂 Load cloud routes button clicked');
    this.loadUserRoutes();
  });
}

    // Make global functions available
    window.showAuthModal = () => this.showAuthModal();
    window.closeAuthModal = () => this.closeAuthModal();
    window.switchToLogin = () => this.switchToLogin();
    window.switchToSignup = () => this.switchToSignup();
  }

  setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.updateUI(user);
      
      if (user) {
        console.log('✅ User signed in:', user.email);
        this.executeCallbacks('onLogin', user);
        this.showCloudSyncIndicator('Connected to cloud');
      } else {
        console.log('👋 User signed out');
        this.executeCallbacks('onLogout');
      }
    });
  }

  adjustLayoutForAuth() {
    // Adjust top-bar position to account for auth status bar
    const topBar = document.querySelector('.top-bar');
    if (topBar) {
      topBar.style.top = '45px'; // Account for auth status bar height
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!emailInput.value || !passwordInput.value) {
      this.showAuthError('Please fill in all fields');
      return;
    }

    try {
      this.setButtonLoading(loginBtn, true);
      
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        emailInput.value, 
        passwordInput.value
      );
      
      console.log('✅ Login successful:', userCredential.user.email);
      this.closeAuthModal();
      this.showSuccessMessage('Welcome back! 🎉');
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      this.showAuthError(this.getFriendlyErrorMessage(error.code));
    } finally {
      this.setButtonLoading(loginBtn, false);
    }
  }

  async handleSignup(event) {
    event.preventDefault();
    
    const signupBtn = document.getElementById('signupBtn');
    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    
    if (!nameInput.value || !emailInput.value || !passwordInput.value) {
      this.showAuthError('Please fill in all fields');
      return;
    }

    if (passwordInput.value.length < 6) {
      this.showAuthError('Password must be at least 6 characters');
      return;
    }

    try {
      this.setButtonLoading(signupBtn, true);
      
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        emailInput.value, 
        passwordInput.value
      );
      
      const user = userCredential.user;
      
      // Save user profile to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: nameInput.value,
        createdAt: new Date().toISOString(),
        routesCount: 0,
        totalDistance: 0
      });
      
      console.log('✅ Signup successful:', user.email);
      this.closeAuthModal();
      this.showSuccessMessage('Account created successfully! Welcome to Access Nature! 🌲');
      
    } catch (error) {
      console.error('❌ Signup failed:', error);
      this.showAuthError(this.getFriendlyErrorMessage(error.code));
    } finally {
      this.setButtonLoading(signupBtn, false);
    }
  }

  async handleGoogleAuth() {
    try {
      this.showCloudSyncIndicator('Connecting to Google...');
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if this is a new user and save profile
      if (result._tokenResponse?.isNewUser) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'Google User',
          createdAt: new Date().toISOString(),
          routesCount: 0,
          totalDistance: 0,
          provider: 'google'
        });
      }
      
      console.log('✅ Google sign-in successful:', user.email);
      this.closeAuthModal();
      this.showSuccessMessage('Successfully connected with Google! 🎉');
      
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        this.showAuthError('Sign-in was cancelled');
      } else {
        this.showAuthError('Google sign-in failed. Please try again.');
      }
    }
  }

  async handleLogout() {
    try {
      const confirmed = confirm('Are you sure you want to sign out?');
      if (!confirmed) return;

      await signOut(auth);
      console.log('👋 Logout successful');
      this.showSuccessMessage('See you next time! 👋');
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      this.showAuthError('Logout failed. Please try again.');
    }
  }

  // UI Management Methods
  updateUI(user) {
    const userInfo = document.getElementById('userInfo');
    const authPrompt = document.getElementById('authPrompt');
    const userEmail = document.getElementById('userEmail');
    const cloudButtons = document.querySelectorAll('.cloud-save-btn, .cloud-load-btn');

    if (user) {
      // Show user info
      userInfo?.classList.remove('hidden');
      authPrompt?.classList.add('hidden');
      if (userEmail) userEmail.textContent = user.email;

      // Enable cloud features
      cloudButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
      });

    } else {
      // Show login prompt
      userInfo?.classList.add('hidden');
      authPrompt?.classList.remove('hidden');

      // Disable cloud features
      cloudButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      });
    }
  }

  showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('hidden');
      this.switchToLogin(); // Default to login
    }
  }

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('hidden');
      this.clearAuthForms();
    }
  }

  switchToLogin() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const title = document.getElementById('authModalTitle');

    loginForm?.classList.add('active');
    signupForm?.classList.remove('active');
    
    if (title) title.textContent = 'Welcome Back!';
  }

  switchToSignup() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const title = document.getElementById('authModalTitle');

    signupForm?.classList.add('active');
    loginForm?.classList.remove('active');
    
    if (title) title.textContent = 'Join Access Nature';
  }

  clearAuthForms() {
    // Clear all form inputs
    const inputs = document.querySelectorAll('#authModal input');
    inputs.forEach(input => input.value = '');
    
    // Clear any error messages
    this.clearAuthError();
  }

  setButtonLoading(button, loading) {
    if (!button) return;

    const textSpan = button.querySelector('.btn-text');
    const spinnerSpan = button.querySelector('.btn-spinner');

    if (loading) {
      button.disabled = true;
      textSpan?.classList.add('hidden');
      spinnerSpan?.classList.remove('hidden');
    } else {
      button.disabled = false;
      textSpan?.classList.remove('hidden');
      spinnerSpan?.classList.add('hidden');
    }
  }

  showAuthError(message) {
    // Remove existing error if any
    this.clearAuthError();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: #ffebee;
      color: #c62828;
      padding: 12px 20px;
      border-radius: 8px;
      margin: 15px 0;
      font-size: 14px;
      border: 1px solid #ffcdd2;
      animation: slideIn 0.3s ease;
    `;

    const activeForm = document.querySelector('.auth-form.active');
    if (activeForm) {
      activeForm.insertBefore(errorDiv, activeForm.firstChild);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => this.clearAuthError(), 5000);
  }

  clearAuthError() {
    const existingError = document.querySelector('.auth-error');
    if (existingError) {
      existingError.remove();
    }
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(76, 175, 80, 0.4);
      animation: slideDown 0.3s ease;
    `;

    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 4000);
  }

  showCloudSyncIndicator(message) {
    const indicator = document.getElementById('cloudSyncIndicator');
    const textElement = indicator?.querySelector('.sync-text');
    
    if (indicator && textElement) {
      textElement.textContent = message;
      indicator.classList.remove('hidden');
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        indicator.classList.add('hidden');
      }, 3000);
    }
  }

  getFriendlyErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  // Cloud functionality methods
// FIXED: Cloud save functionality - handles both current and saved routes
// UPDATED: Simplified cloud save for auth controller (legacy route selection)
async saveCurrentRouteToCloud() {
  if (!this.currentUser) {
    this.showAuthError('Please sign in to save routes to cloud');
    return;
  }

  // This method now handles saved route selection only
  const app = window.AccessNatureApp;
  const state = app?.getController('state');
  const savedSessions = state?.getSessions();
  
  if (!savedSessions || savedSessions.length === 0) {
    alert('❌ No saved routes available to upload to cloud.\n\n💡 To save routes to cloud:\n• Start tracking and record a route\n• The route will be automatically saved to cloud after local save');
    return;
  }
  
  // Let user select from saved routes
  const selectedRoute = this.selectRouteForCloudSave(savedSessions);
  if (!selectedRoute) return;
  
  try {
    this.showCloudSyncIndicator('Uploading saved route to cloud...');
    
    // Use the tracking controller's cloud save method
    const trackingController = app?.getController('tracking');
    if (trackingController && typeof trackingController.saveRouteToCloud === 'function') {
      await trackingController.saveRouteToCloud(
        selectedRoute.data,
        selectedRoute,
        null, // No accessibility data for old routes
        this
      );
    } else {
      throw new Error('Tracking controller not available');
    }
    
  } catch (error) {
    console.error('❌ Failed to upload saved route:', error);
    this.showAuthError('Failed to upload route: ' + error.message);
  }
}

// NEW: Let user select which saved route to upload to cloud
// FIXED: Route selection with proper event handling
selectRouteForCloudSave(sessions) {
  if (!sessions || sessions.length === 0) return null;
  
  // Prevent multiple rapid calls
  if (this.isSelectingRoute) {
    console.log('⏳ Route selection already in progress...');
    return null;
  }
  
  this.isSelectingRoute = true;
  
  try {
    let message = '☁️ Select a route to save to cloud:\n\n';
    sessions.forEach((session, index) => {
      const date = new Date(session.date).toLocaleDateString();
      const time = new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const distance = session.totalDistance ? `${session.totalDistance.toFixed(2)} km` : '0 km';
      const points = session.data ? session.data.length : 0;
      
      message += `${index + 1}. ${session.name}\n`;
      message += `   📅 ${date} ${time} | 📏 ${distance} | 📍 ${points} points\n\n`;
    });

    message += `Enter route number (1-${sessions.length}) or 0 to cancel:`;
    
    const choice = prompt(message);
    
    // Handle cancellation
    if (choice === null || choice === '0' || choice === '') {
      console.log('Route selection cancelled');
      return null;
    }
    
    const choiceNum = parseInt(choice);
    
    if (choiceNum >= 1 && choiceNum <= sessions.length) {
      const selectedRoute = sessions[choiceNum - 1];
      console.log('✅ Route selected:', selectedRoute.name);
      return selectedRoute;
    } else {
      alert('❌ Invalid selection. Please try again.');
      return null;
    }
    
  } finally {
    // Always reset the flag
    setTimeout(() => {
      this.isSelectingRoute = false;
    }, 1000);
  }
}

// UPDATED: Enhanced cloud save with better state management
async saveCurrentRouteToCloud() {
  // Prevent multiple simultaneous saves
  if (this.isSavingToCloud) {
    console.log('⏳ Cloud save already in progress...');
    this.showCloudSyncIndicator('Save already in progress...');
    return;
  }

  if (!this.currentUser) {
    this.showAuthError('Please sign in to save routes to cloud');
    return;
  }

  this.isSavingToCloud = true;

  try {
    const app = window.AccessNatureApp;
    const state = app?.getController('state');
    
    // Check for current route data first
    let routeDataToSave = state?.getRouteData();
    let routeInfo = null;
    
    if (!routeDataToSave || routeDataToSave.length === 0) {
      // No current route data, let user choose from saved routes
      const savedSessions = state?.getSessions();
      
      if (!savedSessions || savedSessions.length === 0) {
        alert('❌ No route data available to save to cloud.\n\n💡 To save routes to cloud:\n• Start tracking and record a route, OR\n• Save a route locally first, then upload it to cloud');
        return;
      }
      
      console.log('📂 No current route data, showing saved routes...');
      
      // Let user select from saved routes
      const selectedRoute = this.selectRouteForCloudSave(savedSessions);
      if (!selectedRoute) {
        console.log('No route selected, cancelling cloud save');
        return;
      }
      
      routeDataToSave = selectedRoute.data;
      routeInfo = selectedRoute;
      
      console.log('✅ Selected route for cloud save:', selectedRoute.name);
    } else {
      // Use current route data
      console.log('📍 Using current route data for cloud save');
      
      const routeName = prompt('Enter a name for this route:');
      if (!routeName) {
        console.log('No route name provided, cancelling save');
        return;
      }
      
      routeInfo = {
        name: routeName.trim(),
        totalDistance: state?.getTotalDistance() || 0,
        elapsedTime: state?.getElapsedTime() || 0,
        date: new Date().toISOString()
      };
    }

    if (!routeDataToSave || routeDataToSave.length === 0) {
      alert('❌ No valid route data to save to cloud');
      return;
    }

    // Show saving indicator
    this.showCloudSyncIndicator('Saving route to cloud...');
    console.log('☁️ Starting cloud save process for:', routeInfo.name);
    
    // Get accessibility data if available
    let accessibilityData = null;
    try {
      const storedAccessibilityData = localStorage.getItem('accessibilityData');
      accessibilityData = storedAccessibilityData ? JSON.parse(storedAccessibilityData) : null;
    } catch (error) {
      console.warn('Could not load accessibility data:', error);
    }

    // Prepare route document for Firestore
    const routeDoc = {
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      routeName: routeInfo.name,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      
      // Route statistics
      totalDistance: routeInfo.totalDistance || 0,
      elapsedTime: routeInfo.elapsedTime || 0,
      originalDate: routeInfo.date,
      
      // Route data
      routeData: routeDataToSave,
      
      // Statistics for quick access
      stats: {
        locationPoints: routeDataToSave.filter(p => p.type === 'location').length,
        photos: routeDataToSave.filter(p => p.type === 'photo').length,
        notes: routeDataToSave.filter(p => p.type === 'text').length,
        totalDataPoints: routeDataToSave.length
      },
      
      // Accessibility information
      accessibilityData: accessibilityData,
      
      // Technical info
      deviceInfo: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        appVersion: '1.0'
      }
    };

    console.log('📤 Uploading route document to Firestore...');

    // Import Firestore functions and save
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const docRef = await addDoc(collection(db, 'routes'), routeDoc);
    
    console.log('✅ Route saved to cloud successfully with ID:', docRef.id);
    this.showSuccessMessage(`✅ "${routeInfo.name}" saved to cloud successfully! ☁️`);
    
    // Update user stats (optional)
    await this.updateUserStats();
    
  } catch (error) {
    console.error('❌ Failed to save route to cloud:', error);
    
    // More specific error messages
    if (error.code === 'permission-denied') {
      this.showAuthError('Permission denied. Please check your Firestore security rules.');
    } else if (error.code === 'quota-exceeded') {
      this.showAuthError('Storage quota exceeded. Please contact support.');
    } else if (error.name === 'FirebaseError') {
      this.showAuthError('Firebase error: ' + error.message);
    } else {
      this.showAuthError('Failed to save route to cloud: ' + error.message);
    }
  } finally {
    // Always reset the saving flag
    this.isSavingToCloud = false;
    
    // Hide sync indicator after a delay
    setTimeout(() => {
      const indicator = document.getElementById('cloudSyncIndicator');
      if (indicator) {
        indicator.classList.add('hidden');
      }
    }, 2000);
  }
}

// UPDATED: Better event listener setup with debouncing
setupEventListeners() {
  // Show auth modal button
  const showAuthBtn = document.getElementById('showAuthBtn');
  if (showAuthBtn) {
    showAuthBtn.addEventListener('click', () => this.showAuthModal());
  }

  // Login form
  const loginForm = document.querySelector('#loginForm form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => this.handleLogin(e));
  }

  // Signup form
  const signupForm = document.querySelector('#signupForm form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => this.handleSignup(e));
  }

  // Google login buttons
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => this.handleGoogleAuth());
  }
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', () => this.handleGoogleAuth());
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => this.handleLogout());
  }

  // Cloud save/load buttons with debouncing
  const saveToCloudBtn = document.getElementById('saveToCloudBtn');
  const loadCloudRoutesBtn = document.getElementById('loadCloudRoutesBtn');
  
  if (saveToCloudBtn) {
    // Remove any existing listeners
    const newSaveBtn = saveToCloudBtn.cloneNode(true);
    saveToCloudBtn.parentNode.replaceChild(newSaveBtn, saveToCloudBtn);
    
    // Add single event listener with debouncing
    newSaveBtn.addEventListener('click', this.debounce(() => {
      console.log('☁️ Cloud save button clicked');
      this.saveCurrentRouteToCloud();
    }, 1000)); // 1 second debounce
  }
  
  if (loadCloudRoutesBtn) {
    // Remove any existing listeners
    const newLoadBtn = loadCloudRoutesBtn.cloneNode(true);
    loadCloudRoutesBtn.parentNode.replaceChild(newLoadBtn, loadCloudRoutesBtn);
    
    // Add single event listener with debouncing
    newLoadBtn.addEventListener('click', this.debounce(() => {
      console.log('📂 Load cloud routes button clicked');
      this.loadUserRoutes();
    }, 1000)); // 1 second debounce
  }

  // Make global functions available
  window.showAuthModal = () => this.showAuthModal();
  window.closeAuthModal = () => this.closeAuthModal();
  window.switchToLogin = () => this.switchToLogin();
  window.switchToSignup = () => this.switchToSignup();
}

// NEW: Debounce utility function
debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


// UPDATED: Enhanced route loading with better feedback
async loadUserRoutes() {
  if (!this.currentUser) {
    this.showAuthError('Please sign in to load your routes');
    return;
  }

  try {
    this.showCloudSyncIndicator('Loading your cloud routes...');

    // Import Firestore functions
    const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const routesQuery = query(
      collection(db, 'routes'),
      where('userId', '==', this.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(routesQuery);
    const routes = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      routes.push({
        id: doc.id,
        ...data,
        // Add computed fields for display
        displayDate: new Date(data.createdAt).toLocaleDateString(),
        displayTime: new Date(data.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        locationCount: data.stats?.locationPoints || 0,
        photoCount: data.stats?.photos || 0,
        noteCount: data.stats?.notes || 0
      });
    });

    if (routes.length === 0) {
      alert('📂 No cloud routes found.\n\n💡 To create cloud routes:\n• Start tracking and record a route\n• Save it locally\n• Then upload it to cloud using "☁️ Save to Cloud"');
      return;
    }

    this.showCloudRoutesList(routes);
    this.showSuccessMessage(`📂 Found ${routes.length} cloud route${routes.length !== 1 ? 's' : ''}!`);
    
  } catch (error) {
    console.error('❌ Failed to load routes:', error);
    
    if (error.code === 'permission-denied') {
      this.showAuthError('Permission denied. Please check your Firestore security rules.');
    } else {
      this.showAuthError('Failed to load routes: ' + error.message);
    }
  }
}

// UPDATED: Better cloud routes display with more info
showCloudRoutesList(routes) {
  let message = '☁️ Your Cloud Routes:\n\n';
  
  routes.forEach((route, index) => {
    message += `${index + 1}. ${route.routeName}\n`;
    message += `   📅 ${route.displayDate} ${route.displayTime}\n`;
    message += `   📏 ${route.totalDistance?.toFixed(2) || 0} km`;
    message += ` | 📍 ${route.locationCount} GPS`;
    message += ` | 📷 ${route.photoCount} photos`;
    message += ` | 📝 ${route.noteCount} notes\n`;
    
    // Show accessibility info if available
    if (route.accessibilityData?.wheelchairAccess) {
      message += `   ♿ ${route.accessibilityData.wheelchairAccess}\n`;
    }
    
    message += '\n';
  });

  message += `Select a route to load (1-${routes.length}):`;
  
  const selectedIndex = prompt(message);
  const index = parseInt(selectedIndex) - 1;
  
  if (index >= 0 && index < routes.length) {
    this.loadCloudRouteData(routes[index]);
  }
}

// UPDATED: Better route loading with statistics
loadCloudRouteData(route) {
  const routeStats = `
📂 Load "${route.routeName}"?

📊 Route Details:
- Distance: ${route.totalDistance?.toFixed(2) || 0} km
- GPS Points: ${route.locationCount}
- Photos: ${route.photoCount}
- Notes: ${route.noteCount}
- Original Date: ${route.displayDate}

⚠️ This will clear your current route data.`;

  const confirmed = confirm(routeStats);
  if (!confirmed) return;

  const app = window.AccessNatureApp;
  const state = app?.getController('state');
  
  if (state && route.routeData) {
    // Clear current data
    state.clearRouteData();
    
    // Load route data
    route.routeData.forEach(point => {
      state.addRoutePoint(point);
    });
    
    // Update distance if available
    if (route.totalDistance) {
      state.updateDistance(route.totalDistance);
    }

    // Load accessibility data if available
    if (route.accessibilityData) {
      localStorage.setItem('accessibilityData', JSON.stringify(route.accessibilityData));
    }

    this.showSuccessMessage(`✅ "${route.routeName}" loaded from cloud!`);
    console.log('✅ Cloud route loaded:', route.routeName);
    
    // Update map if available
    const mapController = app?.getController('map');
    if (mapController && typeof mapController.showRouteData === 'function') {
      mapController.showRouteData(route.routeData);
    }
  }
}

// NEW: Update user statistics (optional)
async updateUserStats() {
  try {
    const { doc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const userRef = doc(db, 'users', this.currentUser.uid);
    await updateDoc(userRef, {
      routesCount: increment(1),
      lastUpload: new Date().toISOString()
    });
    
  } catch (error) {
    console.warn('Failed to update user stats:', error);
    // Don't show error to user for this non-critical operation
  }
}

  async loadUserRoutes() {
    if (!this.currentUser) {
      this.showAuthError('Please sign in to load your routes');
      return;
    }

    try {
      this.showCloudSyncIndicator('Loading your routes...');

      // Import Firestore functions
      const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
      
      const routesQuery = query(
        collection(db, 'routes'),
        where('userId', '==', this.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(routesQuery);
      const routes = [];
      
      querySnapshot.forEach(doc => {
        routes.push({
          id: doc.id,
          ...doc.data()
        });
      });

      if (routes.length === 0) {
        alert('No cloud routes found. Start tracking and save your first route!');
        return;
      }

      this.showRoutesList(routes);
      this.showSuccessMessage(`Found ${routes.length} cloud routes!`);
      
    } catch (error) {
      console.error('❌ Failed to load routes:', error);
      this.showAuthError('Failed to load routes: ' + error.message);
    }
  }

  showRoutesList(routes) {
    const routeNames = routes.map(route => 
      `${route.routeName} (${new Date(route.createdAt).toLocaleDateString()}) - ${route.totalDistance?.toFixed(2) || 0} km`
    );

    const selectedIndex = prompt(
      `Select a route to load:\n${routeNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nEnter number (1-${routes.length}):`
    );

    const index = parseInt(selectedIndex) - 1;
    if (index >= 0 && index < routes.length) {
      this.loadRouteData(routes[index]);
    }
  }

  loadRouteData(route) {
    const confirmed = confirm(`Load "${route.routeName}"? This will clear your current route data.`);
    if (!confirmed) return;

    const app = window.AccessNatureApp;
    const state = app?.getController('state');
    
    if (state) {
      state.clearRouteData();
      
      route.routeData.forEach(point => {
        state.addRoutePoint(point);
      });
      
      if (route.totalDistance) {
        state.updateDistance(route.totalDistance);
      }

      this.showSuccessMessage('Route loaded successfully!');
      console.log('✅ Route loaded:', route.routeName);
    }
  }

  // Event callback system
  onLogin(callback) {
    this.callbacks.onLogin.push(callback);
  }

  onLogout(callback) {
    this.callbacks.onLogout.push(callback);
  }

  executeCallbacks(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  // Getters
  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  cleanup() {
    // Remove global functions
    delete window.showAuthModal;
    delete window.closeAuthModal;
    delete window.switchToLogin;
    delete window.switchToSignup;
  }

  // UPDATED: Enhanced cloud save with auto HTML generation
async saveCurrentRouteToCloud() {
  // ... keep existing code until after docRef is created ...
  
  const docRef = await addDoc(collection(db, 'routes'), routeDoc);
  
  console.log('✅ Route saved to cloud successfully with ID:', docRef.id);
  
  // NEW: Auto-generate trail guide HTML
  await this.generateAndStoreTrailGuide(docRef.id, routeDataToSave, routeInfo, accessibilityData);
  
  this.showSuccessMessage(`✅ "${routeInfo.name}" saved to cloud with trail guide! ☁️`);
  
  // Update user stats (optional)
  await this.updateUserStats();
}

// NEW: Generate and store HTML trail guide automatically
async generateAndStoreTrailGuide(routeId, routeData, routeInfo, accessibilityData) {
  try {
    console.log('🌐 Generating trail guide HTML for:', routeInfo.name);
    
    // Get the export controller to generate HTML
    const app = window.AccessNatureApp;
    const exportController = app?.getController('export');
    
    if (!exportController || typeof exportController.generateRouteSummaryHTML !== 'function') {
      console.warn('Export controller not available for HTML generation');
      return;
    }
    
    const htmlContent = exportController.generateRouteSummaryHTML(routeData, routeInfo, accessibilityData);
    
    // Create trail guide document
    const trailGuideDoc = {
      routeId: routeId,
      routeName: routeInfo.name,
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      htmlContent: htmlContent,
      generatedAt: new Date().toISOString(),
      isPublic: false, // Private by default
      
      // Enhanced metadata for search and discovery
      metadata: {
        totalDistance: routeInfo.totalDistance || 0,
        elapsedTime: routeInfo.elapsedTime || 0,
        originalDate: routeInfo.date,
        locationCount: routeData.filter(p => p.type === 'location').length,
        photoCount: routeData.filter(p => p.type === 'photo').length,
        noteCount: routeData.filter(p => p.type === 'text').length
      },
      
      // Accessibility features for search
      accessibility: accessibilityData ? {
        wheelchairAccess: accessibilityData.wheelchairAccess || 'Unknown',
        trailSurface: accessibilityData.trailSurface || 'Unknown',
        difficulty: accessibilityData.difficulty || 'Unknown',
        facilities: accessibilityData.facilities || [],
        location: accessibilityData.location || 'Unknown'
      } : null,
      
      // Technical info
      stats: {
        fileSize: new Blob([htmlContent]).size,
        version: '1.0',
        generatedBy: 'Access Nature App'
      },
      
      // Community features (for future)
      community: {
        views: 0,
        downloads: 0,
        ratings: [],
        averageRating: 0,
        reviews: []
      }
    };
    
    // Import Firestore and save trail guide
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    const guideRef = await addDoc(collection(db, 'trail_guides'), trailGuideDoc);
    
    console.log('✅ Trail guide generated and stored with ID:', guideRef.id);
    
  } catch (error) {
    console.error('❌ Failed to generate trail guide:', error);
    // Don't fail the main save if HTML generation fails
    this.showCloudSyncIndicator('Route saved, trail guide generation failed');
  }
}

// NEW: Make trail guide public/private
async toggleTrailGuideVisibility(guideId, makePublic) {
  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const updateData = {
      isPublic: makePublic,
      lastModified: new Date().toISOString()
    };
    
    if (makePublic) {
      updateData.publishedAt = new Date().toISOString();
    }
    
    await updateDoc(doc(db, 'trail_guides', guideId), updateData);
    
    this.showSuccessMessage(`✅ Trail guide ${makePublic ? 'published' : 'made private'}!`);
    
  } catch (error) {
    console.error('❌ Failed to update trail guide visibility:', error);
    this.showAuthError('Failed to update guide visibility: ' + error.message);
  }
}

// NEW: Get user's trail guides with management options
async getUserTrailGuides() {
  try {
    const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const guidesQuery = query(
      collection(db, 'trail_guides'),
      where('userId', '==', this.currentUser.uid),
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
    
    return guides;
    
  } catch (error) {
    console.error('❌ Failed to load trail guides:', error);
    throw error;
  }
}

// NEW: Search public trail guides
async searchPublicTrailGuides(filters = {}) {
  try {
    const { collection, query, where, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    let guidesQuery = query(
      collection(db, 'trail_guides'),
      where('isPublic', '==', true),
      orderBy('generatedAt', 'desc'),
      limit(50) // Limit for performance
    );
    
    // Add filters if provided
    if (filters.wheelchairAccess) {
      guidesQuery = query(guidesQuery, where('accessibility.wheelchairAccess', '==', filters.wheelchairAccess));
    }
    
    const querySnapshot = await getDocs(guidesQuery);
    const guides = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      guides.push({
        id: doc.id,
        routeName: data.routeName,
        userEmail: data.userEmail,
        generatedAt: data.generatedAt,
        metadata: data.metadata,
        accessibility: data.accessibility,
        community: data.community,
        // Don't include full HTML content in search results for performance
        hasHtml: !!data.htmlContent
      });
    });
    
    return guides;
    
  } catch (error) {
    console.error('❌ Failed to search trail guides:', error);
    throw error;
  }
}

// NEW: Get specific trail guide with HTML content
async getTrailGuide(guideId) {
  try {
    const { doc, getDoc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const guideRef = doc(db, 'trail_guides', guideId);
    const guideSnap = await getDoc(guideRef);
    
    if (!guideSnap.exists()) {
      throw new Error('Trail guide not found');
    }
    
    const guideData = guideSnap.data();
    
    // Increment view count
    await updateDoc(guideRef, {
      'community.views': increment(1)
    });
    
    return {
      id: guideSnap.id,
      ...guideData
    };
    
  } catch (error) {
    console.error('❌ Failed to get trail guide:', error);
    throw error;
  }
}

// Add these methods to your existing AuthController class

// NEW: Rate a trail guide
async rateTrailGuide(guideId, rating, review = '') {
  if (!this.currentUser) {
    this.showAuthError('Please sign in to rate trail guides');
    return;
  }

  try {
    const { doc, updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const ratingData = {
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      rating: rating,
      review: review,
      timestamp: new Date().toISOString()
    };

    // Add rating to trail guide
    await updateDoc(doc(db, 'trail_guides', guideId), {
      'community.ratings': arrayUnion(ratingData)
    });

    // Recalculate average rating
    await this.updateAverageRating(guideId);

    this.showSuccessMessage('✅ Rating submitted successfully!');

  } catch (error) {
    console.error('❌ Failed to rate trail guide:', error);
    this.showAuthError('Failed to submit rating: ' + error.message);
  }
}

// NEW: Update average rating for a trail guide
async updateAverageRating(guideId) {
  try {
    const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const guideRef = doc(db, 'trail_guides', guideId);
    const guideSnap = await getDoc(guideRef);
    
    if (guideSnap.exists()) {
      const data = guideSnap.data();
      const ratings = data.community?.ratings || [];
      
      if (ratings.length > 0) {
        const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        
        await updateDoc(guideRef, {
          'community.averageRating': Math.round(average * 10) / 10 // Round to 1 decimal
        });
      }
    }

  } catch (error) {
    console.error('❌ Failed to update average rating:', error);
  }
}

// NEW: Search trails by region
async searchTrailsByRegion(region, filters = {}) {
  try {
    const { collection, query, where, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    let guidesQuery = query(
      collection(db, 'trail_guides'),
      where('isPublic', '==', true),
      where('accessibility.location', '>=', region),
      where('accessibility.location', '<=', region + '\uf8ff'),
      orderBy('accessibility.location'),
      orderBy('generatedAt', 'desc'),
      limit(50)
    );

    // Apply additional filters
    if (filters.wheelchairAccess) {
      guidesQuery = query(guidesQuery, where('accessibility.wheelchairAccess', '==', filters.wheelchairAccess));
    }

    const querySnapshot = await getDocs(guidesQuery);
    const guides = [];
    
    querySnapshot.forEach(doc => {
      guides.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return guides;

  } catch (error) {
    console.error('❌ Failed to search trails by region:', error);
    throw error;
  }
}

// NEW: Get trail guide versions (for future versioning feature)
async getTrailGuideVersions(routeId) {
  try {
    const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    
    const versionsQuery = query(
      collection(db, 'trail_guides'),
      where('routeId', '==', routeId),
      orderBy('generatedAt', 'desc')
    );

    const querySnapshot = await getDocs(versionsQuery);
    const versions = [];
    
    querySnapshot.forEach(doc => {
      versions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return versions;

  } catch (error) {
    console.error('❌ Failed to get trail guide versions:', error);
    throw error;
  }
}

// NEW: Update trail guide with new version
async updateTrailGuide(originalGuideId, routeData, routeInfo, accessibilityData) {
  try {
    // Create new version instead of updating existing
    const newGuideDoc = {
      routeId: originalGuideId, // Link to original
      routeName: routeInfo.name,
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      htmlContent: this.generateRouteSummaryHTML(routeData, routeInfo, accessibilityData),
      generatedAt: new Date().toISOString(),
      isPublic: false, // New version starts private
      
      // Version info
      version: {
        previousVersion: originalGuideId,
        versionNumber: 2, // This would be calculated properly
        updateReason: 'Trail conditions updated'
      },
      
      // Copy metadata structure from auto-generation function
      metadata: {
        totalDistance: routeInfo.totalDistance || 0,
        elapsedTime: routeInfo.elapsedTime || 0,
        originalDate: routeInfo.date,
        locationCount: routeData.filter(p => p.type === 'location').length,
        photoCount: routeData.filter(p => p.type === 'photo').length,
        noteCount: routeData.filter(p => p.type === 'text').length
      },
      
      accessibility: accessibilityData ? {
        wheelchairAccess: accessibilityData.wheelchairAccess || 'Unknown',
        trailSurface: accessibilityData.trailSurface || 'Unknown',
        difficulty: accessibilityData.difficulty || 'Unknown',
        facilities: accessibilityData.facilities || [],
        location: accessibilityData.location || 'Unknown'
      } : null,
      
      community: {
        views: 0,
        downloads: 0,
        ratings: [],
        averageRating: 0,
        reviews: []
      }
    };

    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
    const newGuideRef = await addDoc(collection(db, 'trail_guides'), newGuideDoc);

    this.showSuccessMessage('✅ Trail guide updated with new version!');
    return newGuideRef.id;

  } catch (error) {
    console.error('❌ Failed to update trail guide:', error);
    throw error;
  }
}
}

// Auto-initialize when imported
const authController = new AuthController();
document.addEventListener('DOMContentLoaded', () => {
  authController.initialize();
});

export default authController;