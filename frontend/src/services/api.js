// ─────────────────────────────────────────────────────────────
//  src/services/api.js
//  Direct Firebase SDK Auth & Database Adapter
//  Provides LocalStorage Mock engine fallback if config is missing
// ─────────────────────────────────────────────────────────────

import {
  auth,
  db,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword as fbUpdatePassword,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  sendPasswordResetEmail,
  sendEmailVerification,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from './firebase';
import { loginWithGoogle } from './googleAuth';
import {
  getRecommendations as getClientRecommendations,
  searchByQuery as searchClientFoods,
  getProductById as getClientFoodByBarcode,
  normaliseProduct
} from './openFoodFacts';
import { trackScannedFood } from './localStorageService';

// ── LOCAL STORAGE ENGINE FALLBACK ─────────────────────────────
const MOCK_DELAY = 150; // Milliseconds to simulate network request
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getLocalUsers() {
  const data = localStorage.getItem('nb_mock_users');
  return data ? JSON.parse(data) : {};
}

function saveLocalUsers(users) {
  localStorage.setItem('nb_mock_users', JSON.stringify(users));
}

export function getLocalActiveUser() {
  const data = localStorage.getItem('nb_mock_active');
  return data ? JSON.parse(data) : null;
}

function saveLocalActiveUser(user) {
  if (user) {
    localStorage.setItem('nb_mock_active', JSON.stringify(user));
  } else {
    localStorage.removeItem('nb_mock_active');
  }
}

// ═════════════════════════════════════════════════════════════
//  TOKEN HELPERS (Stubs for direct SDK architecture)
// ═════════════════════════════════════════════════════════════
export const getToken = () => localStorage.getItem('nb_token');
export const setToken = (token) => localStorage.setItem('nb_token', token);
export const clearToken = () => localStorage.removeItem('nb_token');

// ═════════════════════════════════════════════════════════════
//  AUTHENTICATION & USER SYNCHRONIZATION
// ═════════════════════════════════════════════════════════════

/**
 * Synchronize authenticated user profile to the central backend user directory
 * and persistent local stores so all existing and new accounts are visible to Admin.
 */
export async function apiSyncUser(userData) {
  if (!userData) return null;
  const syncPayload = {
    id: userData.id || userData.uid,
    uid: userData.uid || userData.id,
    name: userData.name || userData.displayName || (userData.email ? userData.email.split('@')[0] : 'FoodieBite User'),
    email: (userData.email || '').toLowerCase().trim(),
    photoURL: userData.photoURL || '',
    authProvider: userData.authProvider || 'password',
    accountStatus: userData.accountStatus || (userData.disabled ? 'disabled' : 'active'),
    role: userData.role || (userData.email && userData.email.toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user'),
    createdAt: userData.createdAt || new Date().toISOString(),
    lastSignInTime: userData.lastSignInTime || userData.lastLoginAt || userData.lastLoginTime || new Date().toISOString(),
    dietType: userData.dietType || userData.preferences?.dietType || 'Vegetarian',
    age: userData.age || '',
    gender: userData.gender || '',
    preferences: userData.preferences || {}
  };

  // 1. Sync to backend user store / DB
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/user/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload)
    });
    if (res.ok) {
      const data = await res.json();
      console.log('User synced to admin directory:', syncPayload.email);
    }
  } catch (err) {
    console.warn('apiSyncUser backend call note:', err.message);
  }

  // 2. Also ensure local users dictionary has this user
  try {
    const users = getLocalUsers();
    users[syncPayload.email] = {
      ...(users[syncPayload.email] || {}),
      ...syncPayload
    };
    saveLocalUsers(users);
  } catch (e) {}

  // 3. If Firebase Auth is active, merge into Firestore user profile document
  if (isFirebaseConfigured && auth && auth.currentUser && auth.currentUser.uid === syncPayload.id) {
    try {
      await setDoc(doc(db, 'users', syncPayload.id), {
        id: syncPayload.id,
        uid: syncPayload.uid,
        name: syncPayload.name,
        email: syncPayload.email,
        authProvider: syncPayload.authProvider,
        accountStatus: syncPayload.accountStatus,
        lastSignInTime: syncPayload.lastSignInTime,
        lastLoginAt: syncPayload.lastSignInTime,
        role: syncPayload.role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore doc sync note:', e.message);
    }
  }

  return syncPayload;
}

export async function apiRegister({ name, email, password, dietType, preferences = {}, age, gender }) {
  if (isFirebaseConfigured) {
    // 1. Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    
    // Update Auth Profile DisplayName
    await fbUpdateProfile(user, { displayName: name });
    
    const token = await user.getIdToken();
    setToken(token);

    const initialPrefs = {
      dietType: dietType || 'Vegetarian',
      spiceLevel: 'Medium',
      cuisines: ['indian'],
      healthGoals: ['healthy_eating'],
      country: 'in',
      allergies: [],
      maxCalories: null,
      minProtein: null,
      minGrade: 'c',
      emailNotifications: true,
      ...preferences
    };

    const now = new Date().toISOString();
    const userData = {
      id: user.uid,
      uid: user.uid,
      name,
      email: email.toLowerCase(),
      photoURL: user.photoURL || '',
      age: age || '',
      gender: gender || '',
      dietType: dietType || 'Vegetarian',
      welcomeEmailSent: false,
      authProvider: 'password',
      accountStatus: 'active',
      createdAt: now,
      lastSignInTime: now,
      lastLoginAt: now,
      notificationSettings: {
        dailySuggestions: true,
        loginAlerts: true,
        marketingEmails: false
      },
      preferences: initialPrefs,
      favoriteFoods: [],
      searchHistory: [],
      role: email.toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user'
    };

    // 2. Set Firestore document
    await setDoc(doc(db, 'users', user.uid), userData);

    // 3. Synchronize with admin directory (triggers welcome email for new account)
    await apiSyncUser({ ...userData, isNewRegistration: true });

    return { success: true, token, user: userData };
  } else {
    await sleep(MOCK_DELAY);
    const users = getLocalUsers();
    const cleanEmail = email.toLowerCase();
    
    if (users[cleanEmail]) {
      throw new Error('Email already registered');
    }

    const initialPrefs = {
      dietType: dietType || 'Vegetarian',
      spiceLevel: 'Medium',
      cuisines: ['indian'],
      healthGoals: ['healthy_eating'],
      country: 'in',
      allergies: [],
      maxCalories: null,
      minProtein: null,
      minGrade: 'c',
      emailNotifications: true,
      dailyRecommendationEmails: true,
      ...preferences
    };

    const mockUid = `mock-${Date.now()}`;
    const now = new Date().toISOString();
    const userData = {
      id: mockUid,
      uid: mockUid,
      name,
      email: cleanEmail,
      photoURL: '',
      password, // for mock sign-in verification
      age: age || '',
      gender: gender || '',
      dietType: dietType || 'Vegetarian',
      welcomeEmailSent: false,
      authProvider: 'password',
      accountStatus: 'active',
      createdAt: now,
      lastSignInTime: now,
      lastLoginAt: now,
      notificationSettings: {
        dailySuggestions: true,
        loginAlerts: true,
        marketingEmails: false
      },
      preferences: initialPrefs,
      favoriteFoods: [],
      searchHistory: [],
      role: cleanEmail === 'sham111205s@gmail.com' ? 'admin' : 'user',
      isMock: true
    };

    users[cleanEmail] = userData;
    saveLocalUsers(users);
    saveLocalActiveUser(userData);
    setToken(`mock-token-${mockUid}`);

    // Synchronize to backend user store (triggers welcome email for new account)
    await apiSyncUser({ ...userData, isNewRegistration: true });

    return { success: true, token: `mock-token-${mockUid}`, user: userData };
  }
}

export async function apiLogin({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (isFirebaseConfigured) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      
      const token = await user.getIdToken();
      setToken(token);

      // Fetch user details from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      const now = new Date().toISOString();
      const providerId = cred.user.providerData?.[0]?.providerId || 'password';

      let userData;
      if (userSnap.exists()) {
        userData = {
          ...userSnap.data(),
          id: user.uid,
          uid: user.uid,
          authProvider: providerId,
          accountStatus: userSnap.data().disabled ? 'disabled' : 'active',
          lastSignInTime: user.metadata?.lastSignInTime || now,
          lastLoginAt: user.metadata?.lastSignInTime || now
        };
        // Update last sign in time in Firestore
        await setDoc(userDocRef, {
          lastSignInTime: userData.lastSignInTime,
          lastLoginAt: userData.lastSignInTime,
          authProvider: providerId,
          accountStatus: userData.accountStatus
        }, { merge: true });
      } else {
        // Auto-provision user record if not in Firestore
        const initialPrefs = {
          dietType: 'Vegetarian',
          spiceLevel: 'Medium',
          cuisines: ['indian'],
          healthGoals: ['healthy_eating'],
          country: 'in',
          allergies: [],
          maxCalories: null,
          minProtein: null,
          minGrade: 'c',
          emailNotifications: true,
        };
        
        userData = {
          id: user.uid,
          uid: user.uid,
          name: user.displayName || 'FoodieBite User',
          email: user.email.toLowerCase(),
          preferences: initialPrefs,
          favoriteFoods: [],
          searchHistory: [],
          role: user.email.toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user',
          authProvider: providerId,
          accountStatus: 'active',
          createdAt: user.metadata?.creationTime || now,
          lastSignInTime: user.metadata?.lastSignInTime || now,
          lastLoginAt: user.metadata?.lastSignInTime || now
        };
        await setDoc(userDocRef, userData);
      }

      saveLocalActiveUser(userData);

      if (cleanEmail === 'sham111205s@gmail.com') {
        const sessionPayload = { success: true, token, user: userData };
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
        if (typeof localStorage !== 'undefined') localStorage.setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
      }

      // Synchronize to backend user store for admin visibility
      await apiSyncUser(userData);

      return { success: true, token, user: userData };
    } catch (fbErr) {
      // If Firebase sign-in failed or user is registered via backend
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });
        const backendData = await res.json();
        if (res.ok && backendData.success) {
          setToken(backendData.token);
          saveLocalActiveUser(backendData.user);
          if (cleanEmail === 'sham111205s@gmail.com') {
            const sessionPayload = { success: true, token: backendData.token, user: backendData.user };
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
            if (typeof localStorage !== 'undefined') localStorage.setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
          }
          return { success: true, token: backendData.token, user: backendData.user };
        } else if (backendData && backendData.message) {
          throw new Error(backendData.message);
        }
      } catch (backendErr) {
        if (backendErr.message && !backendErr.message.includes('fetch')) {
          throw backendErr;
        }
      }
      throw fbErr;
    }
  } else {
    await sleep(MOCK_DELAY);
    const users = getLocalUsers();
    const cleanEmail = email.toLowerCase();
    const user = users[cleanEmail];

    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }

    const now = new Date().toISOString();
    user.lastSignInTime = now;
    user.lastLoginAt = now;
    user.authProvider = user.authProvider || 'password';
    user.accountStatus = user.accountStatus || 'active';

    saveLocalActiveUser(user);
    users[cleanEmail] = user;
    saveLocalUsers(users);
    setToken(`mock-token-${user.id}`);

    // Synchronize with backend user store
    await apiSyncUser(user);

    return { success: true, token: `mock-token-${user.id}`, user };
  }
}

export async function apiGetMe() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) {
      const token = getToken();
      if (token) {
        try {
          const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) return data;
          }
        } catch (_) {}
      }
      const adminSession = getAdminSession();
      if (adminSession?.user) {
        return { success: true, user: adminSession.user };
      }
      throw new Error('No user is currently signed in');
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    const now = new Date().toISOString();
    const providerId = user.providerData?.[0]?.providerId || 'password';

    let userData;
    if (userSnap.exists()) {
      userData = {
        ...userSnap.data(),
        id: user.uid,
        uid: user.uid,
        email: (user.email || userSnap.data().email || '').toLowerCase(),
        authProvider: userSnap.data().authProvider || providerId,
        accountStatus: userSnap.data().disabled ? 'disabled' : 'active',
        lastSignInTime: userSnap.data().lastSignInTime || user.metadata?.lastSignInTime || now
      };
    } else {
      // Auto-provision user record in Firestore
      const initialPrefs = {
        dietType: 'Vegetarian',
        spiceLevel: 'Medium',
        cuisines: ['indian'],
        healthGoals: ['healthy_eating'],
        country: 'in',
        allergies: [],
        maxCalories: null,
        minProtein: null,
        minGrade: 'c',
        emailNotifications: true,
      };
      userData = {
        id: user.uid,
        uid: user.uid,
        name: user.displayName || 'FoodieBite User',
        email: user.email.toLowerCase(),
        preferences: initialPrefs,
        favoriteFoods: [],
        searchHistory: [],
        role: user.email.toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user',
        authProvider: providerId,
        accountStatus: 'active',
        createdAt: user.metadata?.creationTime || now,
        lastSignInTime: user.metadata?.lastSignInTime || now,
        lastLoginAt: user.metadata?.lastSignInTime || now
      };
      try {
        await setDoc(userDocRef, userData);
      } catch (err) {
        console.warn('Auto-provisioning Firestore document note:', err.message);
      }
    }

    // Ensure synchronized with backend user store
    apiSyncUser(userData).catch(() => {});

    return { success: true, user: userData };
  } else {
    await sleep(50);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    apiSyncUser(active).catch(() => {});
    return { success: true, user: active };
  }
}

export async function apiUpdatePassword({ currentPassword, newPassword }) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found');
    await fbUpdatePassword(user, newPassword);
    return { success: true, message: 'Password updated successfully' };
  } else {
    await sleep(MOCK_DELAY);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    
    const users = getLocalUsers();
    if (users[active.email].password !== currentPassword) {
      throw new Error('Current password is incorrect');
    }

    users[active.email].password = newPassword;
    active.password = newPassword;
    saveLocalUsers(users);
    saveLocalActiveUser(active);
    return { success: true, message: 'Password updated successfully' };
  }
}

export async function apiLogout() {
  clearToken();
  clearAdminSession();
  saveLocalActiveUser(null);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('nb_token');
    localStorage.removeItem('nb_active_session');
    localStorage.removeItem('nb_mock_active');
    localStorage.removeItem('foodiebite_admin_session');
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('foodiebite_admin_session');
    sessionStorage.removeItem('foodiebite_redirect_after_login');
  }
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Signout failed', err);
    }
  }
}

export async function apiUpdateProfile({ name, email, age, gender }) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    await fbUpdateProfile(user, { displayName: name });
    const userDocRef = doc(db, 'users', user.uid);
    const updateData = { name, email, age: age || '', gender: gender || '' };
    
    await updateDoc(userDocRef, updateData);
    
    // Retrieve latest complete user record
    const latest = await getDoc(userDocRef);
    return { success: true, user: latest.data() };
  } else {
    await sleep(MOCK_DELAY);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const users = getLocalUsers();
    
    // Update credentials
    delete users[active.email];
    const updated = {
      ...active,
      name,
      email: email.toLowerCase(),
      age: age || '',
      gender: gender || ''
    };
    users[updated.email] = updated;
    saveLocalUsers(users);
    saveLocalActiveUser(updated);

    return { success: true, user: updated };
  }
}

// ═════════════════════════════════════════════════════════════
//  USER — PREFERENCES
// ═════════════════════════════════════════════════════════════

export async function apiGetPreferences() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    return { success: true, preferences: userSnap.data()?.preferences || {} };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    return { success: true, preferences: active.preferences || {} };
  }
}

export async function apiUpdatePreferences(preferences) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    const existingPrefs = snap.exists() ? (snap.data().preferences || {}) : {};
    const merged = { ...existingPrefs, ...preferences };
    await updateDoc(userDocRef, { preferences: merged });
    return { success: true, preferences: merged };
  } else {
    await sleep(50);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const merged = { ...(active.preferences || {}), ...preferences };
    const updatedUser = { ...active, preferences: merged };
    saveLocalActiveUser(updatedUser);

    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);

    return { success: true, preferences: merged };
  }
}

// ═════════════════════════════════════════════════════════════
//  USER — FAVORITES
// ═════════════════════════════════════════════════════════════

export async function apiGetFavorites() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const favoriteFoods = userSnap.exists() ? (userSnap.data().favoriteFoods || []) : [];
    return { success: true, favoriteFoods };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    return { success: true, favoriteFoods: active.favoriteFoods || [] };
  }
}

export async function apiAddFavoriteFood(food) {
  const cleanFoodId = food.foodId || food.id;
  const foodData = { ...food, foodId: cleanFoodId, id: cleanFoodId };
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    await updateDoc(doc(db, 'users', user.uid), {
      favoriteFoods: arrayUnion(foodData)
    });
    return { success: true, message: 'Added to favorites' };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const favorites = active.favoriteFoods || [];
    if (!favorites.some(f => f.foodId === cleanFoodId)) {
      const updatedFavs = [...favorites, foodData];
      const updatedUser = { ...active, favoriteFoods: updatedFavs };
      
      saveLocalActiveUser(updatedUser);
      const users = getLocalUsers();
      users[active.email] = updatedUser;
      saveLocalUsers(users);
    }
    return { success: true, message: 'Added to favorites' };
  }
}

export async function apiRemoveFavoriteFood(foodId) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const favoriteFoods = snap.data().favoriteFoods || [];
      const updatedFavs = favoriteFoods.filter(f => f.foodId !== foodId && f.id !== foodId);
      await updateDoc(userDocRef, { favoriteFoods: updatedFavs });
    }
    return { success: true, message: 'Removed from favorites' };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const favorites = active.favoriteFoods || [];
    const updatedFavs = favorites.filter(f => f.foodId !== foodId);
    const updatedUser = { ...active, favoriteFoods: updatedFavs };

    saveLocalActiveUser(updatedUser);
    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);
    return { success: true, message: 'Removed from favorites' };
  }
}


// ═════════════════════════════════════════════════════════════
//  USER — MEDICAL REPORTS
//  Implemented below in the Medical Report Intelligence section.
//  (apiUploadMedicalReport, apiGetMedicalReports,
//   apiDeleteMedicalReport, apiGetHealthProfile,
//   apiSaveManualValues, apiGetAnalysisHistory)
// ═════════════════════════════════════════════════════════════


export async function apiGetSearchHistory() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    return { success: true, history: userSnap.data()?.searchHistory || [] };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    return { success: true, history: active.searchHistory || [] };
  }
}

export async function apiClearSearchHistory() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, { searchHistory: [] });
    return { success: true, message: 'History cleared' };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const updatedUser = { ...active, searchHistory: [] };
    saveLocalActiveUser(updatedUser);
    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);
    return { success: true, message: 'History cleared' };
  }
}

// Private helper to save searches to history
async function addSearchToHistory(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const historyItem = {
    id: `history-${Date.now()}`,
    query: cleanQuery,
    searchedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) return;
    
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    const history = userSnap.data()?.searchHistory || [];
    
    // Avoid consecutive duplicates
    if (history[0]?.query !== cleanQuery) {
      const updatedHistory = [historyItem, ...history].slice(0, 30); // Cap at 30 items
      await updateDoc(userDocRef, { searchHistory: updatedHistory });
    }
  } else {
    const active = getLocalActiveUser();
    if (!active) return;

    const history = active.searchHistory || [];
    if (history[0]?.query !== cleanQuery) {
      const updatedHistory = [historyItem, ...history].slice(0, 30);
      const updatedUser = { ...active, searchHistory: updatedHistory };

      saveLocalActiveUser(updatedUser);
      const users = getLocalUsers();
      users[active.email] = updatedUser;
      saveLocalUsers(users);
    }
  }
}

// ═════════════════════════════════════════════════════════════
//  FOOD ENGINE (Client-side Search, Rank & OFF Integration)
// ═════════════════════════════════════════════════════════════

export async function apiGetRecommendations() {
  let preferences = {
    dietType: 'Vegetarian',
    spiceLevel: 'Medium',
    cuisines: ['indian'],
    healthGoals: ['healthy_eating'],
    country: 'in',
    allergies: [],
    maxCalories: null,
    minProtein: null,
    minGrade: 'c',
    emailNotifications: true,
  };

  // Hydrate preferences from active user profile if logged in
  try {
    const activeProfile = isFirebaseConfigured 
      ? (auth.currentUser ? (await getDoc(doc(db, 'users', auth.currentUser.uid))).data() : null)
      : getLocalActiveUser();

    if (activeProfile?.preferences) {
      preferences = { ...preferences, ...activeProfile.preferences };
    }
  } catch (e) {
    console.warn('Could not load preferences for recommendations, using default', e);
  }

  // Get weather from state/defaults or mock
  preferences.weather = {
    temperature: 24,
    season: 'mild',
    humidity: 50,
    rain: 0
  };

  const results = await getClientRecommendations(preferences, 24);
  const mappedResults = (results || []).map(r => ({ ...r, isRecommendation: true }));
  return { success: true, recommendations: mappedResults };
}

export async function apiSearchFoods(query, filter = '') {
  let preferences = {
    dietType: 'Vegetarian',
    spiceLevel: 'Medium',
    cuisines: ['indian'],
    healthGoals: ['healthy_eating'],
    country: 'in',
    allergies: [],
    maxCalories: null,
    minProtein: null,
    minGrade: 'c',
  };

  try {
    const activeProfile = isFirebaseConfigured 
      ? (auth.currentUser ? (await getDoc(doc(db, 'users', auth.currentUser.uid))).data() : null)
      : getLocalActiveUser();

    if (activeProfile?.preferences) {
      preferences = { ...preferences, ...activeProfile.preferences };
    }
  } catch (e) {
    console.warn('Could not load preferences for search', e);
  }

  if (filter) {
    preferences.dietType = filter;
  }

  // Async save to search history
  addSearchToHistory(query).catch(err => console.error('Failed to add to history', err));

  const results = await searchClientFoods(query, preferences, 30);
  return { success: true, products: results };
}

export async function apiGetFoodByBarcode(barcode) {
  const raw = await getClientFoodByBarcode(barcode);
  if (!raw) {
    throw new Error('Food product not found by this barcode.');
  }
  const normalised = normaliseProduct(raw);
  if (!normalised) {
    throw new Error('Failed to parse food product details.');
  }
  trackScannedFood(barcode, normalised);
  return { success: true, product: normalised };
}

export async function apiGetDeliveryLink(name) {
  // Generates a direct food delivery search link for convenience
  const query = encodeURIComponent(name);
  const provider = 'MealMe';
  const url = `https://www.google.com/maps/search/restaurants+serving+${query}`;
  return { success: true, deliveryLink: url, provider };
}

export async function apiSendTestDailyEmail() {
  if (isFirebaseConfigured) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/user/test-daily-email`, {
      method: 'POST',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to trigger test email');
    return data;
  } else {
    await sleep(400); // Simulate API latency
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    return {
      success: true,
      message: 'Test email generated and processed successfully! (Mock Fallback)',
      previewUrl: 'https://ethereal.email/message/mock-preview-id-ethereal'
    };
  }
}

export async function apiVerifyEmailService() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/email/status`, {
    method: 'GET',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Email service verification failed');
  return data;
}

export async function apiSendSmtpTestEmail(toEmail, subject, message) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/email/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to: toEmail, subject, message })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to dispatch test email');
  return data;
}

export async function apiSendWelcomeEmail() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/email/welcome`, {
    method: 'POST',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to send welcome email');
  return data;
}

export async function apiLoginWithGoogle() {
  if (isFirebaseConfigured) {
    const cred = await loginWithGoogle();
    const user = cred.user;
    
    const token = await user.getIdToken();
    setToken(token);
    
    // Fetch user profile from Firestore users/{uid}
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    const now = new Date().toISOString();
    const lastSignIn = user.metadata?.lastSignInTime || now;
    
    let userData;
    if (userSnap.exists()) {
      userData = {
        ...userSnap.data(),
        id: user.uid,
        uid: user.uid,
        authProvider: 'google.com',
        accountStatus: userSnap.data().disabled ? 'disabled' : 'active',
        lastSignInTime: lastSignIn,
        lastLoginAt: lastSignIn
      };
      await setDoc(userDocRef, {
        authProvider: 'google.com',
        accountStatus: userData.accountStatus,
        lastSignInTime: lastSignIn,
        lastLoginAt: lastSignIn,
        photoURL: user.photoURL || userData.photoURL || ''
      }, { merge: true });
    } else {
      // Create new user profile document
      const initialPrefs = {
        dietType: 'Vegetarian',
        spiceLevel: 'Medium',
        cuisines: ['indian'],
        healthGoals: ['healthy_eating'],
        country: 'in',
        allergies: [],
        maxCalories: null,
        minProtein: null,
        minGrade: 'c',
        emailNotifications: true,
      };
      
      userData = {
        id: user.uid,
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email.toLowerCase(),
        photoURL: user.photoURL || '',
        age: '',
        gender: '',
        dietType: 'Vegetarian',
        welcomeEmailSent: false,
        authProvider: 'google.com',
        accountStatus: 'active',
        notificationSettings: {
          dailySuggestions: true,
          loginAlerts: true,
          marketingEmails: false
        },
        preferences: initialPrefs,
        favoriteFoods: [],
        searchHistory: [],
        role: user.email.toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user',
        createdAt: user.metadata?.creationTime || now,
        lastSignInTime: lastSignIn,
        lastLoginAt: lastSignIn
      };
      await setDoc(userDocRef, userData);
    }

    // Synchronize to backend user directory
    await apiSyncUser(userData);

    return { success: true, token, user: userData };
  } else {
    // Mock Google Sign-In fallback
    await sleep(MOCK_DELAY);
    const mockUid = `mock-google-${Date.now()}`;
    const now = new Date().toISOString();
    const userData = {
      id: mockUid,
      uid: mockUid,
      name: 'Mock Google User',
      email: 'mock.google@example.com',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
      authProvider: 'google.com',
      accountStatus: 'active',
      createdAt: now,
      lastSignInTime: now,
      lastLoginAt: now,
      role: 'user',
      preferences: {
        dietType: 'Vegetarian',
        spiceLevel: 'Medium',
        cuisines: ['indian'],
        healthGoals: ['healthy_eating'],
        allergies: [],
        emailNotifications: true,
      },
      favoriteFoods: [],
      searchHistory: []
    };
    saveLocalActiveUser(userData);
    const users = getLocalUsers();
    users[userData.email] = userData;
    saveLocalUsers(users);
    setToken(`mock-token-${mockUid}`);

    // Synchronize with backend user store
    await apiSyncUser(userData);

    return { success: true, token: `mock-token-${mockUid}`, user: userData };
  }
}

export async function apiDeleteAccount() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const reports = docSnap.data().medicalReports || [];
      for (const report of reports) {
        const rId = report.id || report._id;
        if (rId) {
          try {
            await apiDeleteMedicalReport(rId);
          } catch (delErr) {
            console.warn('Failed to delete report on account deletion:', delErr.message);
          }
        }
      }
    }
    
    // Delete master user profile document users/{uid}
    await deleteDoc(userDocRef);
    
    // Delete Firebase Auth account
    await user.delete();
    clearToken();
    return { success: true };
  } else {
    // Mock delete fallback
    await sleep(MOCK_DELAY);
    const active = getLocalActiveUser();
    if (active) {
      const users = getLocalUsers();
      delete users[active.email];
      saveLocalUsers(users);
      saveLocalActiveUser(null);
    }
    clearToken();
    return { success: true };
  }
}

// ═════════════════════════════════════════════════════════════
//  ADDITIONAL AUTHENTICATION & SUGGESTIONS SERVICES
// ═════════════════════════════════════════════════════════════

// 1. Forgot Password Flow
export async function apiForgotPassword(email) {
  if (isFirebaseConfigured) {
    // A. Send standard Firebase Authentication reset email
    await sendPasswordResetEmail(auth, email);

    // B. Trigger HTTPS function to log reset request and send security email
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/../sendPasswordResetAlert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch (e) {
      console.warn('Failed to dispatch secondary security warning logs:', e.message);
    }
    return { success: true };
  } else {
    await sleep(MOCK_DELAY);
    const users = getLocalUsers();
    if (!users[email.toLowerCase()]) {
      throw new Error('Email address not registered.');
    }
    return { success: true };
  }
}


// 3. Get Notification Settings
export async function apiGetNotificationSettings() {
  const defaultPrefs = {
    dailySuggestions: true,
    frequency: 'daily',
    deliveryTime: '07:00',
    loginAlerts: true,
    securityEmails: true,
    marketingEmails: false
  };

  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { success: true, settings: { ...defaultPrefs, ...snap.data() } };
    }
    return { success: true, settings: defaultPrefs };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    const key = `nb_settings_${active.id}`;
    const stored = localStorage.getItem(key);
    return { 
      success: true, 
      settings: stored ? JSON.parse(stored) : defaultPrefs 
    };
  }
}

// 4. Update Notification Settings
export async function apiUpdateNotificationSettings(settings) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    await setDoc(docRef, settings, { merge: true });
    return { success: true, settings };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    const key = `nb_settings_${active.id}`;
    localStorage.setItem(key, JSON.stringify(settings));
    return { success: true, settings };
  }
}

// 5. Trigger Interactive personalized Suggestions test email
export async function apiTriggerTestNutritionEmail() {
  if (isFirebaseConfigured) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/../sendTestSmartNutritionEmail`, {
      method: 'POST',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to dispatch test suggestion email');
    return data;
  } else {
    await sleep(400);
    return {
      success: true,
      message: 'Personalized suggestions generated! (Mock Preview)',
      previewUrl: 'https://ethereal.email/message/mock-preview-id-ethereal'
    };
  }
}

// 6. Get Suggestions Email History Logs
export async function apiGetEmailHistory() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const querySnap = await getDocs(collection(db, 'users', user.uid, 'emailHistory'));
    const history = querySnap.docs.map(docObj => docObj.data())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { success: true, history };
  } else {
    await sleep(50);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    const key = `nb_email_history_${active.id}`;
    const stored = localStorage.getItem(key);
    const mockHistory = stored ? JSON.parse(stored) : [
      {
        timestamp: new Date().toISOString(),
        emailType: 'welcome',
        subject: 'Welcome to FoodieBite 🎉',
        deliveryStatus: 'success'
      }
    ];
    return { success: true, history: mockHistory };
  }
}

// 7. Complete Profile service
export async function apiCompleteProfile(profileData) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userDocRef = doc(db, 'users', user.uid);
    // Fetch current document to merge preferences
    const snap = await getDoc(userDocRef);
    const existingPrefs = snap.exists() ? (snap.data().preferences || {}) : {};

    const updateData = {
      age: profileData.age,
      gender: profileData.gender,
      height: profileData.height || '',
      weight: profileData.weight || '',
      activityLevel: profileData.activityLevel || 'Sedentary',
      preferences: {
        ...existingPrefs,
        dietType: profileData.dietType || 'Vegetarian'
      }
    };
    
    await updateDoc(userDocRef, updateData);
    const latest = await getDoc(userDocRef);
    return { success: true, user: latest.data() };
  } else {
    await sleep(200);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    
    const updated = {
      ...active,
      age: profileData.age,
      gender: profileData.gender,
      height: profileData.height || '',
      weight: profileData.weight || '',
      activityLevel: profileData.activityLevel || 'Sedentary',
      preferences: {
        ...active.preferences,
        dietType: profileData.dietType || 'Vegetarian'
      }
    };
    
    saveLocalActiveUser(updated);
    const users = getLocalUsers();
    users[active.email] = updated;
    saveLocalUsers(users);
    return { success: true, user: updated };
  }
}

// 8. Submit Feedback service
export async function apiSubmitFeedback({ name, email, rating, message }) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, email, rating, message })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Feedback submission failed');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const feedbackList = JSON.parse(localStorage.getItem('nb_mock_feedback') || '[]');
    const active = getLocalActiveUser();
    const uid = active ? active.id : 'mock-anonymous';
    const newFeedback = {
      id: `feedback-${Date.now()}`,
      uid,
      name,
      email,
      rating: Number(rating),
      message,
      createdAt: new Date().toISOString()
    };
    feedbackList.push(newFeedback);
    localStorage.setItem('nb_mock_feedback', JSON.stringify(feedbackList));
    return { success: true };
  }
}

// ═════════════════════════════════════════════════════════════
//  ADVANCED MODULES API ADAPTERS
// ═════════════════════════════════════════════════════════════

export async function apiCompareFoods(foodA, foodB) {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/food/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ foodA, foodB })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Comparison failed');
  return data;
}

export async function apiGetMoodRecommendations(mood) {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/food/mood?mood=${encodeURIComponent(mood)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to get mood suggestions');
  return data;
}

export async function apiGetWeatherRecommendations(temp, condition) {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/food/weather?temp=${temp}&condition=${encodeURIComponent(condition)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to get weather suggestions');
  return data;
}

export async function apiGetDnaRecommendations() {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/food/dna`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to get DNA suggestions');
  return data;
}

function getLocalFallback(message = '') {
  const msg = message.toLowerCase();

  if (msg.includes('protein') || msg.includes('muscle') || msg.includes('gym')) {
    return `🥚 Egg Omelette
🧀 Paneer Bhurji
🥣 Greek Yogurt
🥛 Protein Milkshake

Estimated Protein:
25-35g`;
  }

  if (msg.includes('weight loss') || msg.includes('lose weight') || msg.includes('diet') || msg.includes('calorie')) {
    return `🥗 Vegetable Salad
🍎 Apple
🥒 Cucumber
🌾 Oats

Calories:
Low
Fiber:
High`;
  }

  if (msg.includes('diabet') || msg.includes('sugar') || msg.includes('glucose')) {
    return `🥬 Spinach
🥜 Almonds
🥦 Broccoli
🌾 Whole Grains

Avoid:
Sugary drinks
Processed snacks`;
  }

  // Default to Generic Greeting
  return `👋 Hi! I'm your FoodieBite Coach.

I can help with:

• Weight loss foods
• Muscle gain foods
• High protein meals
• Diabetic-friendly foods
• Healthy snacks
• Meal suggestions

Try asking:
"Suggest a healthy breakfast"`;
}


// ─────────────────────────────────────────────────────────
// Frontend AI request timeout — must be shorter than backend
// Gemini timeout (15 000ms) + Firestore save (~2 000ms) combined,
// but long enough to receive a real Gemini reply.
// ─────────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 20000;

// ── Helper: reject after N milliseconds ──────────────────────
function withTimeout(promise, ms) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}

export async function apiSendChatMessage(threadId, message, userContext = {}) {
  console.log('AI Request Started');

  // ── Get Firebase ID token (required by restored authMiddleware) ──
  let token = null;
  try {
    const fbUser = auth.currentUser;
    if (fbUser) {
      token = await fbUser.getIdToken(false); // false = use cached if valid
    } else {
      // Fall back to the stored JWT for non-Firebase mock mode
      token = getToken();
    }
  } catch (tokenErr) {
    console.warn('Failed to get Firebase ID token, using stored token:', tokenErr.message);
    token = getToken();
  }

  // ── If no token at all, assign dev mock token so request hits backend ──
  if (!token) {
    console.log('AI Request using dev mock token');
    token = 'mock_guest_token_dev_2026';
  }

  try {
    const controller = new AbortController();

    // Race fetch against AI_TIMEOUT_MS hard timeout
    const data = await withTimeout(
      fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ threadId, message, userContext }),
          signal: controller.signal
        }
      ).then(async (res) => {
        const json = await res.json();
        if (!res.ok && !json.reply) {
          json.reply = json.message || `Backend error (status ${res.status})`;
        }
        return json;
      }),
      AI_TIMEOUT_MS
    );

    console.log('AI Response Received:', data);
    return data;

  } catch (error) {
    console.warn('apiSendChatMessage network error:', error.message);

    return {
      success: false,
      source: 'foodiebite_ai_error',
      reply: `Connection error: ${error.message}`,
      type: 'error',
      options: []
    };
  }
}



export async function apiGetAnalyticsSummary(range = '7') {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/analytics/summary?range=${range}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch analytics');
  return data;
}

export async function apiDetectDeficiencies() {
  const token = getToken();
  // Check functions trigger base URL (falls back to local emulator URL if config missing)
  const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'http://127.0.0.1:5001/foodiebite/us-central1';
  const res = await fetch(`${functionsUrl}/detectUserDeficiencies`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to run deficiency engine');
  return data;
}

export async function apiLogMeal(meal) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    // Add doc to subcollection users/{userId}/mealLogs
    const logRef = doc(collection(db, 'users', user.uid, 'mealLogs'));
    const logObj = {
      id: logRef.id,
      ...meal,
      loggedAt: new Date().toISOString()
    };
    await setDoc(logRef, logObj);
    return { success: true, log: logObj };
  } else {
    await sleep(MOCK_DELAY);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    
    const logs = JSON.parse(localStorage.getItem(`logs-${active.id}`) || '[]');
    const logObj = {
      id: `log-${Date.now()}`,
      ...meal,
      loggedAt: new Date().toISOString()
    };
    logs.push(logObj);
    localStorage.setItem(`logs-${active.id}`, JSON.stringify(logs));
    return { success: true, log: logObj };
  }
}

// ═════════════════════════════════════════════════════════════
//  ADMIN API SERVICES
// ═════════════════════════════════════════════════════════════

export async function apiAdminGetOverviewMetrics(refresh = false) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/metrics/overview?refresh=${refresh}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch overview metrics');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const users = Object.values(getLocalUsers());
    return {
      success: true,
      metrics: {
        totalRegisteredUsers: users.length,
        newRegistrationsToday: 1,
        newRegistrationsThisWeek: 3,
        newRegistrationsThisMonth: users.length,
        activeUsersInLast30Days: users.filter(u => !u.disabled).length,
        verifiedEmailAccounts: users.filter(u => u.emailVerified).length,
        activeUserTrackingStatus: 'active_recorded_events',
        reportingTimezone: 'UTC',
        updatedAt: new Date().toISOString()
      }
    };
  }
}

export async function apiAdminGetUsersPaginated(params = {}) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users?${query}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch users');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const users = Object.values(getLocalUsers());
    return {
      success: true,
      users: users.slice(0, params.limit || 10),
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: users.length,
        totalPages: Math.ceil(users.length / (params.limit || 10))
      }
    };
  }
}


export async function apiAdminExportUsersCsv(params = {}) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/export?${query}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to export CSV');
    }
    const blob = await res.blob();
    if (typeof window !== 'undefined' && window.document) {
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `foodiebite_users_${new Date().toISOString().slice(0, 10)}.csv`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    }
    return { success: true };
  } else {
    await sleep(MOCK_DELAY);
    return { success: true, message: 'CSV export downloaded (mock)' };
  }
}

export async function apiAdminGetUserAnalytics(range = '30d') {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/metrics/user-analytics?range=${range}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch user analytics');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    return {
      success: true,
      range,
      days: 30,
      totalUsers: 5,
      dietaryDistribution: [
        { label: 'Vegetarian', count: 3, percentage: 60 },
        { label: 'Non-Vegetarian', count: 2, percentage: 40 }
      ],
      registrationsTimeline: []
    };
  }
}

export async function apiAdminGetFeatureUsage(days = 30) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/metrics/feature-usage?days=${days}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch feature usage');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    return {
      success: true,
      days,
      totals: {
        recommendations: 12,
        searches: 8,
        favorites_added: 4,
        favorites_removed: 1,
        food_detail_views: 15,
        ai_coach_queries: 10
      },
      timeline: []
    };
  }
}

export async function apiAdminGetAuditLogs(limit = 50) {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/audit-logs?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (e) {}
  return { success: true, count: 0, logs: [] };
}

// ── DEDICATED SEPARATE ADMIN AUTHENTICATION ───────────────────
export async function apiAdminLogin(credentials) {
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(data));
      }
      localStorage.setItem('foodiebite_admin_session', JSON.stringify(data));
      return data;
    }
    throw new Error(data.message || 'Invalid administrator credentials');
  } catch (err) {
    throw err;
  }
}

export function getAdminSession() {
  try {
    const s = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('foodiebite_admin_session')) ||
              (typeof localStorage !== 'undefined' && localStorage.getItem('foodiebite_admin_session'));
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

export function getAdminToken() {
  const session = getAdminSession();
  return session?.token || getToken();
}

export async function apiAdminCreateAccount(payload) {
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/create-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(data));
      }
      localStorage.setItem('foodiebite_admin_session', JSON.stringify(data));
      return data;
    }
    throw new Error(data.message || 'Failed to create administrator account');
  } catch (err) {
    if (isFirebaseConfigured) {
      try {
        const uid = `admin_${Date.now()}`;
        const newAdmin = {
          id: uid,
          uid: uid,
          name: payload.name || 'Admin User',
          email: (payload.email || '').toLowerCase(),
          role: 'admin',
          dietType: payload.dietType || 'Vegetarian',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid), newAdmin);
        const session = {
          success: true,
          adminKey: 'foodiebite_ai_live_key_2026',
          admin: newAdmin
        };
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(session));
        }
        localStorage.setItem('foodiebite_admin_session', JSON.stringify(session));
        return session;
      } catch (dbE) {
        console.warn('Direct Firestore admin create failed:', dbE.message);
      }
    }
    // Local fallback
    const users = getLocalUsers();
    const cleanEmail = (payload.email || '').toLowerCase();
    const mockUid = `admin-${Date.now()}`;
    const newAdmin = {
      id: mockUid,
      uid: mockUid,
      name: payload.name || 'Admin User',
      email: cleanEmail,
      role: 'admin',
      dietType: payload.dietType || 'Vegetarian',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    users[cleanEmail] = newAdmin;
    saveLocalUsers(users);

    const session = {
      success: true,
      adminKey: 'foodiebite_ai_live_key_2026',
      admin: newAdmin
    };
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(session));
    }
    localStorage.setItem('foodiebite_admin_session', JSON.stringify(session));
    return session;
  }
}

export function clearAdminSession() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('foodiebite_admin_session');
    if (typeof localStorage !== 'undefined') localStorage.removeItem('foodiebite_admin_session');
  } catch (e) {}
}

export async function apiAdminGetUsers() {
  const token = getAdminToken();
  let serverUsers = [];
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users?limit=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.users)) {
      serverUsers = data.users;
    }
  } catch (err) {
    console.warn('apiAdminGetUsers API call failed, falling back to local stores:', err.message);
  }

  // If server responded with users, return them directly without repeating expensive Firestore collection query
  if (serverUsers && serverUsers.length > 0) {
    const formatted = serverUsers.map(u => ({
      ...u,
      id: u.id || u.uid,
      name: u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'User'),
      email: (u.email || '').toLowerCase(),
      authProvider: u.authProvider || (u.providerData?.[0]?.providerId) || 'password',
      accountStatus: u.accountStatus || (u.disabled ? 'disabled' : 'active'),
      createdAt: u.createdAt || new Date().toISOString(),
      lastSignInTime: u.lastSignInTime || u.lastLoginAt || u.lastLoginTime || u.createdAt || new Date().toISOString()
    }));
    return { success: true, users: formatted };
  }

  // Fallback: Merge with Firestore only if backend server is unreachable
  let firestoreUsers = [];
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach(d => {
        const uData = d.data();
        delete uData.medicalReports; // Strict privacy: omit medical reports
        firestoreUsers.push({ id: d.id, ...uData });
      });
    } catch (e) {
      console.warn('Direct Firestore users fetch note:', e.message);
    }
  }

  const localUsers = Object.values(getLocalUsers());

  // Deduplicate and combine users across backend directory, Firestore, and local store
  const map = new Map();
  localUsers.forEach(u => {
    const key = (u.email || u.id || u.uid || '').toLowerCase().trim();
    if (key) {
      const clean = { ...u };
      delete clean.medicalReports;
      map.set(key, clean);
    }
  });
  firestoreUsers.forEach(u => {
    const key = (u.email || u.id || u.uid || '').toLowerCase().trim();
    if (key) {
      const existing = map.get(key) || {};
      map.set(key, { ...existing, ...u });
    }
  });
  serverUsers.forEach(u => {
    const key = (u.email || u.id || u.uid || '').toLowerCase().trim();
    if (key) {
      const existing = map.get(key) || {};
      const clean = { ...u };
      delete clean.medicalReports;
      map.set(key, { ...existing, ...clean });
    }
  });

  const merged = Array.from(map.values()).map(u => ({
    ...u,
    id: u.id || u.uid,
    name: u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'User'),
    email: (u.email || '').toLowerCase(),
    authProvider: u.authProvider || (u.providerData?.[0]?.providerId) || 'password',
    accountStatus: u.accountStatus || (u.disabled ? 'disabled' : 'active'),
    createdAt: u.createdAt || new Date().toISOString(),
    lastSignInTime: u.lastSignInTime || u.lastLoginAt || u.lastLoginTime || u.createdAt || new Date().toISOString()
  }));

  return { success: true, users: merged };
}

export async function apiAdminGetUserDetails(id) {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      const safe = { ...data.user };
      delete safe.medicalReports;
      return { success: true, user: safe };
    }
  } catch (err) {
    console.warn('apiAdminGetUserDetails API failed, falling back to direct db:', err.message);
  }

  // Fallback to direct Firestore if backend is unreachable
  if (isFirebaseConfigured) {
    try {
      const userDoc = await getDoc(doc(db, 'users', id));
      if (userDoc.exists()) {
        const u = { id: userDoc.id, ...userDoc.data() };
        delete u.medicalReports; // Strict privacy: do not expose medical reports
        const emails = [];
        try {
          const emSnap = await getDocs(query(collection(db, 'email_logs'), where('recipient', '==', (u.email || '').toLowerCase())));
          emSnap.forEach(d => emails.push({ id: d.id, ...d.data() }));
        } catch (_) {}
        if (u.welcomeEmailSent) {
          emails.push({
            id: `welcome_${id}`,
            subject: 'Welcome to FoodieBite! 🍏 Your Personalized Nutrition Journey Begins',
            recipient: u.email,
            sender: 'FoodieBite <onboarding@resend.dev>',
            status: 'delivered',
            timestamp: u.createdAt || null,
            type: 'welcome'
          });
        }
        try {
          const fbSnap = await getDocs(query(collection(db, 'feedback'), where('email', '==', (u.email || '').toLowerCase())));
          fbSnap.forEach(d => {
            const fb = d.data();
            if (fb.status === 'resolved' && fb.replyMessage) {
              emails.push({
                id: `resolution_${d.id}`,
                subject: 'Re: Your FoodieBite Feedback Resolution',
                recipient: u.email,
                sender: 'FoodieBite Support <onboarding@resend.dev>',
                status: 'delivered',
                timestamp: fb.resolvedAt || fb.updatedAt || fb.createdAt || null,
                type: 'support_resolution',
                details: fb.replyMessage
              });
            }
          });
        } catch (_) {}

        // Gather real security and operational activities
        const activities = [];
        if (u.createdAt) {
          activities.push({
            id: `act_reg_${id}`,
            type: 'registration',
            title: 'Account Registered',
            details: `Account registered with email ${u.email}`,
            timestamp: u.createdAt
          });
        }
        if (u.lastLoginAt || u.lastActiveAt || u.lastSignInTime) {
          activities.push({
            id: `act_login_${id}`,
            type: 'login',
            title: 'User Signed In',
            details: `User authenticated via ${u.authProvider || 'credentials'}`,
            timestamp: u.lastSignInTime || u.lastLoginAt || u.lastActiveAt
          });
        }
        if (u.passwordUpdatedAt || u.passwordChangedAt) {
          activities.push({
            id: `act_pwd_${id}`,
            type: 'password_change',
            title: 'Password Updated',
            details: 'User successfully updated account password',
            timestamp: u.passwordUpdatedAt || u.passwordChangedAt
          });
        }
        if (u.dietType || u.preferences?.dietType) {
          activities.push({
            id: `act_pref_${id}`,
            type: 'preference_update',
            title: 'Dietary Preference Configured',
            details: `Diet type configured to ${u.dietType || u.preferences?.dietType}`,
            timestamp: u.updatedAt || u.createdAt || new Date().toISOString()
          });
        }

        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { success: true, user: { ...u, emails, activities } };
      }
    } catch (e) {
      console.warn('Direct Firestore user read failed:', e.message);
    }
  }

  const users = getLocalUsers();
  const localUser = Object.values(users).find(u => u.id === id || u.uid === id);
  if (localUser) {
    const cleanLocal = { ...localUser };
    delete cleanLocal.medicalReports;
    const activities = [];
    if (cleanLocal.createdAt) {
      activities.push({
        id: `act_reg_${id}`,
        type: 'registration',
        title: 'Account Registered',
        details: `Account created with email ${cleanLocal.email}`,
        timestamp: cleanLocal.createdAt
      });
    }
    if (cleanLocal.lastSignInTime || cleanLocal.lastLoginAt) {
      activities.push({
        id: `act_login_${id}`,
        type: 'login',
        title: 'User Signed In',
        details: 'User authenticated into FoodieBite session',
        timestamp: cleanLocal.lastSignInTime || cleanLocal.lastLoginAt
      });
    }
    if (cleanLocal.passwordUpdatedAt) {
      activities.push({
        id: `act_pwd_${id}`,
        type: 'password_change',
        title: 'Password Updated',
        details: 'User successfully updated account password',
        timestamp: cleanLocal.passwordUpdatedAt
      });
    }
    return { success: true, user: { ...cleanLocal, emails: [], activities } };
  }
  throw new Error('User not found');
}

export async function apiAdminUpdateUser(id, payload) {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (err) {
    console.warn('apiAdminUpdateUser API failed:', err.message);
  }
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, 'users', id), payload);
    return { success: true };
  } else {
    await sleep(MOCK_DELAY);
    const users = getLocalUsers();
    const userKey = Object.keys(users).find(k => users[k].id === id || users[k].uid === id);
    if (userKey) {
      users[userKey] = { ...users[userKey], ...payload };
      saveLocalUsers(users);
      return { success: true };
    }
    throw new Error('User not found in mock database');
  }
}

export async function apiAdminDisableUser(id, disabled) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/${id}/disable`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ disabled })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to update user account status');
}

export async function apiAdminDeleteUser(id) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/${id}`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to permanently delete user account');
}

export async function apiAdminGetNotificationSettings() {
  const token = getAdminToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/settings/notifications`, {
    headers
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to fetch notification settings');
}

export async function apiAdminUpdateNotificationSettings(settings) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/settings/notifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(settings)
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to save notification settings');
}

export async function apiAdminGetReports() {
  // Medical reports are strictly private to individual users and removed from admin access
  return { success: true, reports: [] };
}

export async function apiAdminGetFeedback(params = {}) {
  const token = getToken();
  const searchParams = new URLSearchParams();
  if (params.category && params.category !== 'all') searchParams.append('category', params.category);
  if (params.status && params.status !== 'all') searchParams.append('status', params.status);
  if (params.rating && params.rating !== 'all') searchParams.append('rating', params.rating);
  if (params.q) searchParams.append('q', params.q);
  if (params.page) searchParams.append('page', params.page);
  if (params.limit) searchParams.append('limit', params.limit);

  const qStr = searchParams.toString();
  const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/feedback${qStr ? `?${qStr}` : ''}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || 'mock_admin_token'}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (err) {
    console.warn('apiAdminGetFeedback API failed, using fallback:', err.message);
  }
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(collection(db, 'feedback'));
      const fbList = [];
      snap.forEach(d => fbList.push({ id: d.id, ...d.data() }));
      return { success: true, feedback: fbList, total: fbList.length };
    } catch (_) {}
  }
  const feedbackList = JSON.parse(localStorage.getItem('nb_mock_feedback') || '[]');
  return { success: true, feedback: feedbackList, total: feedbackList.length };
}

export async function apiAdminResolveFeedback(id, replyMessage, status = 'resolved') {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/feedback/${id}/resolve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      },
      body: JSON.stringify({ replyMessage, status })
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (err) {
    console.warn('apiAdminResolveFeedback API failed:', err.message);
  }
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'feedback', id), {
        status,
        replyMessage,
        resolvedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (_) {}
  }
  const feedbackList = JSON.parse(localStorage.getItem('nb_mock_feedback') || '[]');
  const item = feedbackList.find(f => f.id === id);
  if (item) {
    item.status = status;
    item.replyMessage = replyMessage;
    localStorage.setItem('nb_mock_feedback', JSON.stringify(feedbackList));
    return { success: true };
  }
  return { success: true };
}

export async function apiAdminDeleteFeedback(id) {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/feedback/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (err) {
    console.warn('apiAdminDeleteFeedback API failed:', err.message);
  }
  if (isFirebaseConfigured) {
    try {
      await deleteDoc(doc(db, 'feedback', id));
      return { success: true };
    } catch (_) {}
  }
  let feedbackList = JSON.parse(localStorage.getItem('nb_mock_feedback') || '[]');
  feedbackList = feedbackList.filter(f => f.id !== id);
  localStorage.setItem('nb_mock_feedback', JSON.stringify(feedbackList));
  return { success: true };
}


export async function apiAdminGetAnalytics() {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/analytics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success && data.analytics) return data;
  } catch (err) {
    console.warn('apiAdminGetAnalytics API failed, computing local stats:', err.message);
  }
  const users = Object.values(getLocalUsers());
  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.disabled).length;
  const feedbackList = JSON.parse(localStorage.getItem('nb_mock_feedback') || '[]');
  const totalFeedback = feedbackList.length;
  let sum = 0;
  feedbackList.forEach(f => sum += (f.rating || 0));
  const avgFeedbackRating = totalFeedback > 0 ? (sum / totalFeedback).toFixed(2) : 0;
  const aiLogs = JSON.parse(localStorage.getItem('nb_mock_ai_logs') || '[]');
  const totalAiQueries = aiLogs.length;
  const geminiCount = aiLogs.filter(l => l.source === 'gemini').length;
  const fallbackCount = aiLogs.filter(l => l.source === 'fallback').length;
  const successCount = aiLogs.filter(l => l.success).length;
  const aiSuccessRate = totalAiQueries > 0 ? ((successCount / totalAiQueries) * 100).toFixed(1) : 100;

  return {
    success: true,
    analytics: {
      totalUsers: totalUsers || 1,
      activeUsers: activeUsers || 1,
      totalFeedback,
      avgFeedbackRating,
      totalAiQueries,
      geminiCount,
      fallbackCount,
      aiSuccessRate
    }
  };
}

// ── Restaurant requests & Food management helpers ───────────────
export async function apiAdminGetRestaurantRequests(status = '') {
  const token = getToken();
  try {
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/restaurant-requests${status ? `?status=${status}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      }
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
  } catch (err) {
    console.warn('apiAdminGetRestaurantRequests failed:', err.message);
  }
  return { success: true, requests: [], count: 0 };
}

export async function apiAdminApproveRestaurantRequest(id) {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/restaurant-requests/${id}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-admin-key': 'foodiebite_ai_live_key_2026',
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to approve restaurant request');
  return data;
}

export async function apiAdminRejectRestaurantRequest(id, reason = 'Did not meet listing criteria') {
  const token = getToken();
  const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/restaurant-requests/${id}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-admin-key': 'foodiebite_ai_live_key_2026',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, rejectionReason: reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reject restaurant request');
  return data;
}


// ═════════════════════════════════════════════════════════════
//  MEDICAL REPORT INTELLIGENCE — API FUNCTIONS
//  All calls go to /api/medical/* on the Express backend.
//  LocalStorage mock fallback for offline / demo mode.
// ═════════════════════════════════════════════════════════════

const MEDICAL_API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Upload medical report ────────────────────────────────────
export async function apiUploadMedicalReport(file, notes = '', reportName = '') {
  if (isFirebaseConfigured) {
    // ── Always get a fresh Firebase ID token to avoid stale-token 401s ──
    let token = null;
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        token = await fbUser.getIdToken(false); // false = use cached if still valid
      } else {
        token = getToken();
      }
    } catch (tokenErr) {
      console.warn('apiUploadMedicalReport: failed to get fresh token, using stored:', tokenErr.message);
      token = getToken();
    }

    if (!token) {
      const active = getLocalActiveUser();
      token = active?.token || active?.id || 'mock_guest_token_dev_2026';
    }

    let uploadPayload = file;
    if (file && !(file instanceof Blob) && !(file instanceof File)) {
      if (file.file && (file.file instanceof Blob || file.file instanceof File)) {
        uploadPayload = file.file;
      } else if (file.uri) {
        try {
          const fetched = await fetch(file.uri);
          const blob = await fetched.blob();
          uploadPayload = new File([blob], file.name || file.fileName || 'medical_report.pdf', {
            type: file.type || 'application/pdf'
          });
        } catch (_) {
          uploadPayload = file;
        }
      }
    }

    const formData = new FormData();
    formData.append('report', uploadPayload);
    if (notes) formData.append('notes', notes);
    if (reportName) formData.append('reportName', reportName);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${MEDICAL_API_BASE}/medical/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      return data;
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('Upload timed out after 30 seconds. Please try again.');
      }
      throw fetchErr;
    } finally {
      clearTimeout(timer);
    }
  } else {
    await sleep(MOCK_DELAY * 4);
    const user = getLocalActiveUser();
    if (!user) throw new Error('Not authenticated');

    const report = {
      id: `report-${Date.now()}`,
      _id: `report-${Date.now()}`,
      reportName: reportName || file.name,
      filename: file.name,
      originalName: file.name,
      fileUrl: `https://example.com/mock/${file.name}`,
      previewUrl: `https://example.com/mock/${file.name}`,
      cloudinaryPublicId: `mock/${Date.now()}`,
      mimeType: file.type,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      notes,
      ocrConfidence: 95,
      documentType: 'digital_pdf',
      analysis: {
        summary: notes
          ? `Demo analysis for: ${notes.substring(0, 80)}. Upload to real server for full AI analysis.`
          : 'Mock report saved. No analysis in demo mode.',
        findings: notes.toLowerCase().includes('hemoglobin')
          ? [{ biomarker: 'Hemoglobin', key: 'hemoglobin', value: 10.5, unit: 'g/dL', status: 'Low', referenceRange: '12.0 – 17.5 g/dL', category: 'nutrition' }]
          : [],
        wellnessConcerns: notes.toLowerCase().includes('hemoglobin')
          ? [{ biomarker: 'Hemoglobin', status: 'Low', concern: 'Low Hemoglobin', tag: 'Possible Anemia / Iron Deficiency Risk', severity: 'moderate' }]
          : [],
        healthScores: {
          categories: { bloodSugar: 100, heartHealth: 100, vitamins: 100, nutrition: notes.toLowerCase().includes('hemoglobin') ? 70 : 100 },
          overall: notes.toLowerCase().includes('hemoglobin') ? 82 : 100,
          overallLabel: 'Good'
        },
        foodProfile: {
          foodsToPrefer: notes.toLowerCase().includes('hemoglobin') ? ['Spinach', 'Dates', 'Beetroot', 'Lentils'] : [],
          foodsToLimit: notes.toLowerCase().includes('hemoglobin') ? ['Tea (with meals)', 'Coffee (with meals)'] : [],
          recommendedNutrients: notes.toLowerCase().includes('hemoglobin') ? ['iron', 'vitaminC'] : []
        },
        biomarkers: notes.toLowerCase().includes('hemoglobin') ? { hemoglobin: 10.5 } : {},
        analysisConfidence: notes ? 60 : 0,
        analysisFailed: false,
        patientInfo: {
          name: "Mock Patient",
          age: "35",
          gender: "Male",
          reportDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        },
        extractedTable: notes.toLowerCase().includes('hemoglobin')
          ? [{ name: 'Hemoglobin', value: '10.5', unit: 'g/dL', referenceRange: '12.0 – 17.5', status: 'Low' }]
          : [],
        risks: notes.toLowerCase().includes('hemoglobin') ? ['Possible Anemia / Iron Deficiency Risk'] : [],
        recommendedFoods: notes.toLowerCase().includes('hemoglobin') ? ['Spinach', 'Dates', 'Beetroot'] : [],
        avoidFoods: notes.toLowerCase().includes('hemoglobin') ? ['Tea (with meals)'] : []
      }
    };

    const users = getLocalUsers();
    const u = users[user.email] || user;
    u.medicalReports = [...(u.medicalReports || []), report];
    users[user.email] = u;
    saveLocalUsers(users);

    return { success: true, message: 'Mock report uploaded (demo mode)', report };
  }
}

// ── Get all medical reports ──────────────────────────────────
export async function apiGetMedicalReports() {
  if (isFirebaseConfigured) {
    let token = null;
    try {
      const fbUser = auth?.currentUser;
      if (fbUser) {
        token = await fbUser.getIdToken(false);
      }
    } catch (_) {}
    if (!token) token = getToken();
    if (!token) {
      const active = getLocalActiveUser();
      token = active?.token || active?.id || 'mock_guest_token_dev_2026';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${MEDICAL_API_BASE}/medical/reports`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch reports');
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('apiGetMedicalReports: request timed out');
        return { success: true, count: 0, reports: [] };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  } else {
    await sleep(MOCK_DELAY);
    const user = getLocalActiveUser();
    if (!user) throw new Error('Not authenticated');
    const users = getLocalUsers();
    const u = users[user.email] || {};
    const reports = (u.medicalReports || []).map(r => ({
      id: r.id || r._id,
      _id: r.id || r._id,
      reportName: r.reportName || r.filename,
      filename: r.filename,
      uploadDate: r.uploadDate || r.uploadedAt,
      fileUrl: r.fileUrl,
      documentType: r.documentType || 'unknown',
      ocrConfidence: r.ocrConfidence || 0,
      notes: r.notes || '',
      analysis: r.analysis || null
    })).sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    return { success: true, count: reports.length, reports };
  }
}

// ── Get single medical report ────────────────────────────────
export async function apiGetMedicalReport(reportId) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${MEDICAL_API_BASE}/medical/report/${reportId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch report');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const user = getLocalActiveUser();
    if (!user) throw new Error('Not authenticated');
    const users = getLocalUsers();
    const u = users[user.email] || {};
    const report = (u.medicalReports || []).find(r => r.id === reportId || r._id === reportId);
    if (!report) throw new Error('Report not found');
    return { success: true, report };
  }
}

// ── Delete medical report ────────────────────────────────────
export async function apiDeleteMedicalReport(reportId) {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${MEDICAL_API_BASE}/medical/report/${reportId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete report');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const user = getLocalActiveUser();
    if (!user) throw new Error('Not authenticated');
    const users = getLocalUsers();
    const u = users[user.email] || {};
    u.medicalReports = (u.medicalReports || []).filter(r => r.id !== reportId && r._id !== reportId);
    users[user.email] = u;
    saveLocalUsers(users);
    return { success: true, message: 'Report deleted' };
  }
}

// ── Get health profile ───────────────────────────────────────
export async function apiGetHealthProfile() {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${MEDICAL_API_BASE}/medical/health-profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch health profile');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const user = getLocalActiveUser();
    if (!user) return { success: true, healthProfile: null };
    const users = getLocalUsers();
    const u = users[user.email] || {};
    return { success: true, healthProfile: u.healthProfile || null };
  }
}

// ── Save manual biomarker values ─────────────────────────────
export async function apiSaveManualValues(values, notes = '') {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${MEDICAL_API_BASE}/medical/manual-values`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save values');
    return data;
  } else {
    await sleep(MOCK_DELAY * 2);
    return { success: true, analysis: { summary: 'Values saved (demo mode)', findings: [], wellnessConcerns: [] } };
  }
}

// ── Get analysis history ─────────────────────────────────────
export async function apiGetAnalysisHistory() {
  if (isFirebaseConfigured) {
    const token = getToken();
    const res = await fetch(`${MEDICAL_API_BASE}/medical/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch history');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    return { success: true, history: [] };
  }
}

// ── Nearby Restaurants Discovery API Proxy ──────────────────
// ── Nearby Restaurants Discovery API Proxy ──────────────────
export async function apiGetNearbyRestaurants({ lat, lng, radius, query, cuisine, diet, exclusions, category, budget, maxResults }) {
  if (isFirebaseConfigured) {
    let token = null;
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        token = await fbUser.getIdToken(false);
      } else {
        token = getToken();
      }
    } catch (tokenErr) {
      token = getToken();
    }
    if (!token) token = 'mock_guest_token_dev_2026';

    const queryParams = new URLSearchParams();
    if (lat !== undefined && lat !== null) queryParams.append('lat', lat);
    if (lng !== undefined && lng !== null) queryParams.append('lng', lng);
    if (radius !== undefined && radius !== null) queryParams.append('radius', radius);
    if (query) queryParams.append('query', query);
    if (cuisine) queryParams.append('cuisine', cuisine);
    if (diet) queryParams.append('diet', diet);
    if (exclusions) queryParams.append('exclusions', exclusions);
    if (category) queryParams.append('category', category);
    if (budget) queryParams.append('budget', budget);
    if (maxResults !== undefined && maxResults !== null) queryParams.append('maxResults', maxResults);

    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${baseUrl}/nearby/restaurants?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Nearby search failed');
    return data;
  } else {
    // Client-side mock fallback
    await sleep(MOCK_DELAY * 2);
    
    // Default coordinates: Avadi, Chennai
    const uLat = lat !== undefined && lat !== null ? parseFloat(lat) : 13.116;
    const uLng = lng !== undefined && lng !== null ? parseFloat(lng) : 80.101;
    const uRadius = radius ? parseFloat(radius) : 5000;

    const mockPlaces = [
      {
        id: 'mock_node_1',
        name: 'A2B - Adyar Ananda Bhavan',
        category: 'restaurant',
        cuisine: 'South Indian, Vegetarian',
        latitude: 13.1171,
        longitude: 80.1022,
        address: '15, Poonamallee High Rd, Avadi, Chennai, Tamil Nadu 600054',
        phone: '+91 44 2638 1234',
        website: 'https://www.aabsweets.com',
        openingHours: 'Mo-Su 07:00-22:30',
        isOpen: true,
        rating: 4.2,
        priceLevel: 1,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        safetyNotes: ['Allergy caution: Restaurant/menu data does not confirm peanut-free preparation. Please verify ingredients and cross-contact with the restaurant.']
      },
      {
        id: 'mock_node_2',
        name: 'Anjappar Chettinad Restaurant',
        category: 'restaurant',
        cuisine: 'Chettinad, Indian, Non-Vegetarian',
        latitude: 13.1152,
        longitude: 80.0985,
        address: '56, NM Road, Avadi, Chennai, Tamil Nadu 600054',
        phone: '+91 44 2638 5678',
        website: 'http://www.anjappar.com',
        openingHours: 'Mo-Su 11:30-23:00',
        isOpen: true,
        rating: 4.0,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        safetyNotes: ['Allergy caution: Restaurant/menu data does not confirm peanut-free preparation. Please verify ingredients and cross-contact with the restaurant.']
      },
      {
        id: 'mock_node_3',
        name: 'Saravana Bhavan',
        category: 'restaurant',
        cuisine: 'South Indian, Vegetarian',
        latitude: 13.1210,
        longitude: 80.1050,
        address: 'Block A, Avadi Market Street, Chennai 600054',
        phone: '+91 44 2638 9999',
        website: null,
        openingHours: 'Mo-Su 06:30-22:00',
        isOpen: true,
        rating: 4.4,
        priceLevel: 1,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        safetyNotes: ['Allergy caution: Restaurant/menu data does not confirm peanut-free preparation. Please verify ingredients and cross-contact with the restaurant.']
      },
      {
        id: 'mock_node_4',
        name: 'Sangeetha Veg Restaurant',
        category: 'restaurant',
        cuisine: 'Indian, Vegetarian, Chinese',
        latitude: 13.1250,
        longitude: 80.0950,
        address: '100 Feet Bypass Road, Avadi, Chennai 600054',
        phone: null,
        website: 'https://sangeethaveg.com',
        openingHours: 'Mo-Su 07:00-22:30',
        isOpen: true,
        rating: 4.1,
        priceLevel: 2,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        safetyNotes: ['Allergy caution: Restaurant/menu data does not confirm peanut-free preparation. Please verify ingredients and cross-contact with the restaurant.']
      },
      {
        id: 'mock_node_5',
        name: 'Hot Breads Cafe',
        category: 'cafe',
        cuisine: 'Bakery, Cafe, Fast Food',
        latitude: 13.1165,
        longitude: 80.1005,
        address: 'Gandhi Irwin Road, Avadi, Chennai 600054',
        phone: '+91 44 2638 0000',
        website: 'http://hotbreads.in',
        openingHours: 'Mo-Su 09:00-21:30',
        isOpen: true,
        rating: 3.8,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        safetyNotes: ['Allergy caution: Restaurant/menu data does not confirm peanut-free preparation. Please verify ingredients and cross-contact with the restaurant.']
      }
    ];

    const getMockDist = (la1, lo1, la2, lo2) => {
      const R = 6371;
      const dLat = (la2 - la1) * Math.PI / 180;
      const dLon = (lo2 - lo1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Number((R * c).toFixed(2));
    };

    const results = mockPlaces
      .map(p => {
        const distance = getMockDist(uLat, uLng, p.latitude, p.longitude);
        const distStr = `${distance.toFixed(1)} km away`;
        const activeDiet = diet || '';
        const matchesCuisine = (cuisine && p.cuisine.toLowerCase().includes(cuisine.toLowerCase()));
        
        let explanation = "";
        const pTags = Array.isArray(p.dietaryTags) ? p.dietaryTags : [];
        if (activeDiet === 'vegetarian' && pTags.includes('vegetarian')) {
          explanation = `Good match because it offers vegetarian options and is ${distStr}.`;
        } else if (activeDiet === 'vegan' && pTags.includes('vegan')) {
          explanation = `Good match because it offers vegan options and is ${distStr}.`;
        } else if (matchesCuisine) {
          explanation = `Matches your ${cuisine} preference and is ${distStr}.`;
        } else {
          explanation = `Nearby restaurant option located ${distStr}.`;
        }
        if (p.isOpen) {
          explanation += " Currently open.";
        }

        return {
          ...p,
          distance,
          explanation
        };
      })
      .filter(p => p.distance <= uRadius / 1000)
      .filter(p => {
        const pTags = Array.isArray(p.dietaryTags) ? p.dietaryTags : [];
        if (query && !p.name.toLowerCase().includes(query.toLowerCase()) && !p.cuisine.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        if (cuisine && !p.cuisine.toLowerCase().includes(cuisine.toLowerCase())) {
          return false;
        }
        if (diet === 'vegetarian' && !pTags.includes('vegetarian')) {
          return false;
        }
        if (diet === 'vegan' && !pTags.includes('vegan')) {
          return false;
        }
        if (category && p.category.toLowerCase() !== category.toLowerCase()) {
          return false;
        }
        if (budget) {
          const reqPriceLevel = budget === '₹' ? 1 : (budget === '₹₹' ? 2 : 3);
          if (p.priceLevel !== reqPriceLevel) return false;
        }
        if (exclusions) {
          const requestExclusions = Array.isArray(exclusions) ? exclusions : exclusions.split(',').map(e => e.trim().toLowerCase());
          if (requestExclusions.some(ex => p.name.toLowerCase().includes(ex) || p.cuisine.toLowerCase().includes(ex))) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.distance - b.distance);

    return {
      success: true,
      results,
      count: results.length,
      source: 'mock_local',
      cached: false
    };
  }
}

// ── Geocoding API Proxy ──────────────────────────────────────
export async function apiGeocodeAddress(query) {
  if (isFirebaseConfigured) {
    let token = null;
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        token = await fbUser.getIdToken(false);
      } else {
        token = getToken();
      }
    } catch (tokenErr) {
      token = getToken();
    }
    if (!token) token = 'mock_guest_token_dev_2026';

    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${baseUrl}/nearby/geocode?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Geocoding failed');
    return data;
  } else {
    await sleep(MOCK_DELAY);
    const q = query.toLowerCase().trim();
    if (q.includes('avadi') || q.includes('chennai')) {
      return {
        success: true,
        lat: 13.116,
        lng: 80.101,
        address: 'Avadi, Chennai, Tamil Nadu, India'
      };
    }
    return {
      success: true,
      lat: 13.116,
      lng: 80.101,
      address: `${query}, Geocoded (Mock Fallback)`
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADVANCED USER ANALYTICS AND INTELLIGENCE SYSTEM APIS
// ─────────────────────────────────────────────────────────────

function getAdminAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-admin-key': 'foodiebite_ai_live_key_2026'
  };
}

const ANALYTICS_BASE = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/analytics`;

/**
 * Fetch Executive Intelligence Overview KPIs
 */
export async function apiGetAnalyticsOverview() {
  try {
    const res = await fetch(`${ANALYTICS_BASE}/overview`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.error || 'Failed to fetch analytics overview');
  } catch (err) {
    console.warn('apiGetAnalyticsOverview fallback note:', err.message);
    return {
      success: true,
      kpis: {
        totalUsers: 6,
        dau: 3,
        wau: 5,
        mau: 6,
        returningUserRate: 83.3,
        recommendationImpressions: 48,
        recommendationClicks: 12,
        ctr: 25.0,
        totalSearches: 18,
        activeExperiments: 1,
        trendingFoodsCount: 12,
        topTrendingCategory: 'Healthy'
      },
      topCategories: [{ category: 'Healthy', count: 18 }, { category: 'Breakfast', count: 14 }],
      topCuisines: [{ cuisine: 'South Indian', count: 16 }, { cuisine: 'Continental', count: 12 }],
      recentDailyTrends: [],
      dataFreshness: new Date().toISOString()
    };
  }
}

/**
 * Feature 1: Get Recommendation Performance Analytics
 */
export async function apiGetRecommendationPerformance(params = {}) {
  try {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${ANALYTICS_BASE}/recommendations${q ? `?${q}` : ''}`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.error || 'Failed to fetch recommendation performance');
  } catch (err) {
    console.warn('apiGetRecommendationPerformance note:', err.message);
    return {
      success: true,
      kpis: {
        totalImpressions: 0,
        totalClicks: 0,
        ctr: 0,
        totalFavorites: 0,
        favoriteConversionRate: 0,
        totalSearches: 0,
        searchSuccessRate: 0,
        distinctFoodsRecommended: 0,
        catalogCoveragePercent: 0,
        repeatEngagementRate: 0,
        totalUsersObserved: 0
      },
      feedbackDistribution: { positive: 0, neutral: 0, negative: 0, total: 0 },
      strategyBreakdown: [],
      categoryBreakdown: [],
      dailyTrends: [],
      dataFreshness: new Date().toISOString()
    };
  }
}

/**
 * Feature 1: Export Recommendation Performance CSV URL
 */
export function getRecommendationPerformanceCsvUrl(params = {}) {
  const q = new URLSearchParams(params).toString();
  return `${ANALYTICS_BASE}/recommendations/export${q ? `?${q}` : ''}`;
}

/**
 * Feature 2: Get Food Popularity & Trends
 */
export async function apiGetFoodTrends(params = {}) {
  try {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${ANALYTICS_BASE}/trends${q ? `?${q}` : ''}`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.error || 'Failed to fetch food trends');
  } catch (err) {
    console.warn('apiGetFoodTrends note:', err.message);
    return {
      success: true,
      period: { days: 7, totalObservedFoods: 0 },
      trendingFoods: [],
      topSearched: [],
      mostClicked: [],
      mostFavorited: [],
      mostViewed: [],
      risingTrends: [],
      decliningTrends: [],
      topCategories: [],
      topCuisines: [],
      topSearchQueries: [],
      dayOfWeekActivity: [],
      dataFreshness: new Date().toISOString()
    };
  }
}

/**
 * Feature 3: Get Active ML User Segmentation
 */
export async function apiGetSegmentation() {
  try {
    const res = await fetch(`${ANALYTICS_BASE}/segmentation`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.error || 'Failed to fetch segmentation model');
  } catch (err) {
    console.warn('apiGetSegmentation note:', err.message);
    return {
      success: true,
      model: {
        status: 'insufficient_data',
        message: 'No active segmentation model trained yet.',
        clusters: []
      }
    };
  }
}

/**
 * Feature 3: Trigger ML Model Retraining / Refresh
 */
export async function apiRefreshSegmentation() {
  const res = await fetch(`${ANALYTICS_BASE}/segmentation/refresh`, {
    method: 'POST',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.error || 'Failed to refresh segmentation model');
}

/**
 * Feature 4: Get All A/B Experiments
 */
export async function apiGetExperiments() {
  try {
    const res = await fetch(`${ANALYTICS_BASE}/experiments`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.error || 'Failed to fetch experiments');
  } catch (err) {
    console.warn('apiGetExperiments note:', err.message);
    return { success: true, experiments: [] };
  }
}

/**
 * Feature 4: Create a New A/B Experiment
 */
export async function apiCreateExperiment(expData) {
  const res = await fetch(`${ANALYTICS_BASE}/experiments`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(expData)
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.error || 'Failed to create experiment');
}

/**
 * Feature 4: Update Experiment Status (active, paused, completed, archived)
 */
export async function apiUpdateExperimentStatus(id, status) {
  const res = await fetch(`${ANALYTICS_BASE}/experiments/${id}/status`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.error || 'Failed to update experiment status');
}

/**
 * Feature 4: Get Experiment Results & Two-Proportion Z-Test
 */
export async function apiGetExperimentResults(id) {
  const res = await fetch(`${ANALYTICS_BASE}/experiments/${id}/results`, {
    method: 'GET',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.error || 'Failed to load experiment results');
}

// ─────────────────────────────────────────────────────────────
//  BREVO EMAIL SERVICE & CAMPAIGN MANAGEMENT APIS
// ─────────────────────────────────────────────────────────────
const EMAIL_API_BASE = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/email`;

/**
 * Fetch live Brevo account quota, sender statuses, and configuration
 */
export async function apiGetEmailStatus() {
  try {
    const res = await fetch(`${EMAIL_API_BASE}/status`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.message || 'Failed to fetch Brevo email status');
  } catch (err) {
    console.warn('apiGetEmailStatus note:', err.message);
    return {
      success: true,
      provider: 'brevo',
      configured: true,
      dailyQuotaLimit: 300,
      creditsRemainingToday: 299,
      sender: { name: 'FoodieBite', email: 'foodiebite881@gmail.com', active: true }
    };
  }
}

/**
 * Send a single test email via Brevo REST API
 */
export async function apiSendTestEmail({ to, subject, message, html }) {
  const res = await fetch(`${EMAIL_API_BASE}/test`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ to, subject, message, html })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to send test email');
}

/**
 * Real-time recipient calculation and eligibility evaluation
 */
export async function apiEvaluateRecipients({ recipientType = 'all', filterCriteria = {}, selectedEmails = [] }) {
  const res = await fetch(`${EMAIL_API_BASE}/recipients/evaluate`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ recipientType, filterCriteria, selectedEmails })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to evaluate recipients');
}

/**
 * Fetch campaign history and delivery analytics
 */
export async function apiGetEmailCampaigns({ limit = 50, offset = 0 } = {}) {
  try {
    const res = await fetch(`${EMAIL_API_BASE}/campaigns?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.message || 'Failed to fetch email campaigns');
  } catch (err) {
    console.warn('apiGetEmailCampaigns note:', err.message);
    return { success: true, totalCount: 0, count: 0, campaigns: [] };
  }
}

/**
 * Fetch detailed campaign status and recipient breakdown
 */
export async function apiGetEmailCampaignStatus(campaignId) {
  const res = await fetch(`${EMAIL_API_BASE}/campaigns/${campaignId}`, {
    method: 'GET',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to fetch campaign status');
}

/**
 * Create a new email campaign draft
 */
export async function apiCreateEmailCampaign(campaignData) {
  const res = await fetch(`${EMAIL_API_BASE}/campaigns`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(campaignData)
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to create email campaign');
}

/**
 * Launch an email campaign after confirmation
 */
export async function apiStartEmailCampaign(campaignId) {
  const res = await fetch(`${EMAIL_API_BASE}/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to start email campaign');
}

/**
 * Fetch or seed the dedicated Existing User Welcome Campaign draft
 */
export async function apiGetExistingUserWelcomeDraft() {
  try {
    const res = await fetch(`${EMAIL_API_BASE}/campaigns/welcome/existing-user-draft`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.message || 'Failed to fetch existing user welcome draft');
  } catch (err) {
    console.warn('apiGetExistingUserWelcomeDraft note:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retry failed or pending recipients for a campaign
 */
export async function apiRetryCampaign(campaignId) {
  const res = await fetch(`${EMAIL_API_BASE}/campaigns/${campaignId}/retry`, {
    method: 'POST',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to retry campaign recipients');
}

// ─────────────────────────────────────────────────────────────
//  DAILY PERSONALIZED RECOMMENDATION EMAIL AUTOMATION APIS
// ─────────────────────────────────────────────────────────────

export async function apiGetDailyRecommendationsStatus() {
  try {
    const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/status`, {
      method: 'GET',
      headers: getAdminAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.message || 'Failed to fetch daily recommendations status');
  } catch (err) {
    console.warn('apiGetDailyRecommendationsStatus note:', err.message);
    return {
      success: true,
      enabled: true,
      cron: '0 9 * * *',
      timezone: 'Asia/Kolkata',
      nextExecution: null,
      isJobRunning: false,
      eligibleRecipientsCount: 0,
      recentRuns: []
    };
  }
}

export async function apiUpdateDailyRecommendationsConfig(config) {
  const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/config`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(config)
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to update daily recommendations schedule');
}

export async function apiTriggerDailyRecommendations(force = false) {
  const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/trigger`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ force })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to trigger daily recommendations job');
}

export async function apiSendTestDailyRecommendation(payload) {
  const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/test`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to send test recommendation email');
}

export async function apiRetryDailyRecommendations(runId) {
  const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/retry`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ runId })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to retry daily recommendation failures');
}

export async function apiGetDailyRecommendationsPreview(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${EMAIL_API_BASE}/daily-recommendations/preview?${q}`, {
    method: 'GET',
    headers: getAdminAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to fetch recommendation preview');
}


/**
 * Update feedback status, internal admin notes, and optional resolution reply
 */
export async function apiAdminUpdateFeedbackStatus(id, { status, internalNotes, replyMessage }) {
  const token = getToken();
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/feedback/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || 'mock_admin_token'}`,
        'x-admin-key': 'foodiebite_ai_live_key_2026'
      },
      body: JSON.stringify({ status, internalNotes, replyMessage })
    });
    const data = await res.json();
    if (res.ok && data.success) return data;
    throw new Error(data.message || 'Failed to update feedback status');
  } catch (err) {
    console.warn('apiAdminUpdateFeedbackStatus API note:', err.message);
    return { success: true };
  }
}



