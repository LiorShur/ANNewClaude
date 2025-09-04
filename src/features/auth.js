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
    const saveToCloudBtn = document.getElementById('saveToCloudBtn');
    const loadCloudRoutesBtn = document.getElementById('loadCloudRoutesBtn');
    
    if (saveToCloudBtn) {
      saveToCloudBtn.addEventListener('click', () => this.saveCurrentRouteToCloud());
    }
    if (loadCloudRoutesBtn) {
      loadCloudRoutesBtn.addEventListener('click', () => this.loadUserRoutes());
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
  async saveCurrentRouteToCloud() {
    if (!this.currentUser) {
      this.showAuthError('Please sign in to save routes to cloud');
      return;
    }

    const app = window.AccessNatureApp;
    const routeData = app?.getController('state')?.getRouteData();
    
    if (!routeData || routeData.length === 0) {
      alert('No route data to save. Start tracking first!');
      return;
    }

    try {
      this.showCloudSyncIndicator('Saving route to cloud...');
      
      const routeName = prompt('Enter a name for this route:') || `Route ${new Date().toLocaleDateString()}`;
      
      const routeDoc = {
        userId: this.currentUser.uid,
        userEmail: this.currentUser.email,
        routeName: routeName,
        createdAt: new Date().toISOString(),
        totalDistance: app?.getController('state')?.getTotalDistance() || 0,
        elapsedTime: app?.getController('state')?.getElapsedTime() || 0,
        routeData: routeData,
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };

      // Import Firestore functions
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");
      
      const docRef = await addDoc(collection(db, 'routes'), routeDoc);
      
      this.showSuccessMessage('Route saved to cloud successfully! ☁️');
      console.log('✅ Route saved to cloud with ID:', docRef.id);
      
    } catch (error) {
      console.error('❌ Failed to save route to cloud:', error);
      this.showAuthError('Failed to save route to cloud: ' + error.message);
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
}

// Auto-initialize when imported
const authController = new AuthController();
document.addEventListener('DOMContentLoaded', () => {
  authController.initialize();
});

export default authController;