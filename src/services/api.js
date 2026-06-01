// ─────────────────────────────────────────────────────────────
//  src/services/api.js
//  Direct Firebase SDK Auth & Database Adapter
//  Provides LocalStorage Mock engine fallback if config is missing
// ─────────────────────────────────────────────────────────────

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword as fbUpdatePassword,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import {
  getRecommendations as getClientRecommendations,
  searchByQuery as searchClientFoods,
  getProductById as getClientFoodByBarcode,
  normaliseProduct
} from './openFoodFacts';

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

function getLocalActiveUser() {
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
//  AUTHENTICATION
// ═════════════════════════════════════════════════════════════

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
      notificationSettings: {
        dailySuggestions: true,
        loginAlerts: true,
        marketingEmails: false
      },
      preferences: initialPrefs,
      favoriteFoods: [],
      medicalReports: [],
      searchHistory: [],
      createdAt: new Date().toISOString()
    };

    // 2. Set Firestore document
    await setDoc(doc(db, 'users', user.uid), userData);
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
      ...preferences
    };

    const mockUid = `mock-${Date.now()}`;
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
      welcomeEmailSent: true, // Welcome email sent immediately in mock
      notificationSettings: {
        dailySuggestions: true,
        loginAlerts: true,
        marketingEmails: false
      },
      preferences: initialPrefs,
      favoriteFoods: [],
      medicalReports: [],
      searchHistory: [],
      isMock: true
    };

    users[cleanEmail] = userData;
    saveLocalUsers(users);
    saveLocalActiveUser(userData);
    setToken(`mock-token-${mockUid}`);

    return { success: true, token: `mock-token-${mockUid}`, user: userData };
  }
}

export async function apiLogin({ email, password }) {
  if (isFirebaseConfigured) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    
    const token = await user.getIdToken();
    setToken(token);

    // Fetch user details from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      return { success: true, token, user: userSnap.data() };
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
      
      const userData = {
        id: user.uid,
        name: user.displayName || 'FoodieBite User',
        email: user.email,
        preferences: initialPrefs,
        favoriteFoods: [],
        medicalReports: [],
        searchHistory: [],
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, userData);
      return { success: true, token, user: userData };
    }
  } else {
    await sleep(MOCK_DELAY);
    const users = getLocalUsers();
    const cleanEmail = email.toLowerCase();
    const user = users[cleanEmail];

    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }

    saveLocalActiveUser(user);
    setToken(`mock-token-${user.id}`);
    return { success: true, token: `mock-token-${user.id}`, user };
  }
}

export async function apiGetMe() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in');

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      return { success: true, user: userSnap.data() };
    }
    throw new Error('User record not found in Firestore');
  } else {
    await sleep(50);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
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

export function apiLogout() {
  clearToken();
  if (isFirebaseConfigured) {
    signOut(auth).catch(err => console.error('Signout failed', err));
  } else {
    saveLocalActiveUser(null);
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
    await updateDoc(userDocRef, { preferences });
    return { success: true, preferences };
  } else {
    await sleep(50);
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const updatedUser = { ...active, preferences };
    saveLocalActiveUser(updatedUser);

    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);

    return { success: true, preferences };
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
// ═════════════════════════════════════════════════════════════

export async function apiUploadMedicalReport(file, notes = '') {
  const reportId = `report-${Date.now()}`;
  
  // Create a stunning mock base64 data-uri preview if real file
  let mockFilePreview = 'data:application/pdf;base64,JVBERi0xLjQKJ...';
  if (file && file.name) {
    mockFilePreview = `data:text/plain;base64,${btoa(file.name + ' - Mock Report Details')}`;
  }

  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    let previewUrl = mockFilePreview;
    let cloudinaryPublicId = '';
    
    // Upload actual file to Cloudinary if valid file object
    if (file && file.size) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
        formData.append('cloud_name', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dvuv4dphe');

        const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dvuv4dphe'}/auto/upload`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.secure_url) {
          previewUrl = data.secure_url;
          cloudinaryPublicId = data.public_id;
        } else {
          throw new Error(data.error?.message || 'Cloudinary upload failed');
        }
      } catch (storageError) {
        console.warn('Cloudinary upload failed, using mock preview', storageError);
      }
    }

    const reportObj = {
      id: reportId,
      _id: reportId,
      filename: file?.name || 'report.pdf',
      originalName: file?.name || 'report.pdf',
      reportName: file?.name || 'report.pdf',
      fileUrl: previewUrl,
      previewUrl,
      uploadDate: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      cloudinaryPublicId: cloudinaryPublicId || '',
      notes: notes || ''
    };
    
    await updateDoc(doc(db, 'users', user.uid), {
      medicalReports: arrayUnion(reportObj)
    });
    return { success: true, report: reportObj };
  } else {
    await sleep(400); // simulate upload progress
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const reportObj = {
      id: reportId,
      _id: reportId,
      filename: file?.name || 'report.pdf',
      originalName: file?.name || 'report.pdf',
      reportName: file?.name || 'report.pdf',
      fileUrl: mockFilePreview,
      previewUrl: mockFilePreview,
      uploadDate: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      cloudinaryPublicId: `mock-cloudinary-${reportId}`,
      notes: notes || ''
    };

    const reports = active.medicalReports || [];
    const updatedReports = [...reports, reportObj];
    const updatedUser = { ...active, medicalReports: updatedReports };

    saveLocalActiveUser(updatedUser);
    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);

    return { success: true, report: reportObj };
  }
}

export async function apiGetMedicalReports() {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const reports = userSnap.exists() ? (userSnap.data().medicalReports || []) : [];
    return { success: true, reports };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');
    return { success: true, reports: active.medicalReports || [] };
  }
}

export async function apiDeleteMedicalReport(reportId) {
  if (isFirebaseConfigured) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const reports = docSnap.data().medicalReports || [];
      const report = reports.find(r => r.id === reportId || r._id === reportId);
      
      if (report && report.cloudinaryPublicId) {
        try {
          await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/user/medical/${encodeURIComponent(report.cloudinaryPublicId)}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${getToken()}`
            }
          });
        } catch (e) {
          console.warn('Failed to delete report from Cloudinary', e);
        }
      }
      
      const updatedReports = reports.filter(r => r.id !== reportId && r._id !== reportId);
      await updateDoc(userDocRef, { medicalReports: updatedReports });
    }
    return { success: true, message: 'Medical report deleted' };
  } else {
    const active = getLocalActiveUser();
    if (!active) throw new Error('Not authenticated');

    const reports = active.medicalReports || [];
    const updatedReports = reports.filter(r => r._id !== reportId && r.id !== reportId);
    const updatedUser = { ...active, medicalReports: updatedReports };

    saveLocalActiveUser(updatedUser);
    const users = getLocalUsers();
    users[active.email] = updatedUser;
    saveLocalUsers(users);
    return { success: true, message: 'Medical report deleted' };
  }
}

// ═════════════════════════════════════════════════════════════
//  USER — SEARCH HISTORY
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
  return { success: true, recommendations: results };
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

export async function apiLoginWithGoogle() {
  if (isFirebaseConfigured) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    
    const token = await user.getIdToken();
    setToken(token);
    
    // Fetch user profile from Firestore users/{uid}
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    
    let userData;
    if (userSnap.exists()) {
      userData = userSnap.data();
    } else {
      // Create new user profile document!
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
        notificationSettings: {
          dailySuggestions: true,
          loginAlerts: true,
          marketingEmails: false
        },
        preferences: initialPrefs,
        favoriteFoods: [],
        medicalReports: [],
        searchHistory: [],
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, userData);
    }
    return { success: true, token, user: userData };
  } else {
    // Mock Google Sign-In fallback
    await sleep(MOCK_DELAY);
    const mockUid = `mock-google-${Date.now()}`;
    const userData = {
      id: mockUid,
      uid: mockUid,
      name: 'Mock Google User',
      email: 'mock.google@example.com',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
      preferences: {
        dietType: 'Vegetarian',
        spiceLevel: 'Medium',
        cuisines: ['indian'],
        healthGoals: ['healthy_eating'],
        allergies: [],
        emailNotifications: true,
      },
      favoriteFoods: [],
      medicalReports: [],
      searchHistory: []
    };
    saveLocalActiveUser(userData);
    setToken(`mock-token-${mockUid}`);
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
        if (report.cloudinaryPublicId) {
          try {
            await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/user/medical/${encodeURIComponent(report.cloudinaryPublicId)}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${getToken()}`
              }
            });
          } catch (cloudinaryError) {
            console.warn('Failed to delete report from Cloudinary:', cloudinaryError.message);
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
    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous';
    const feedbackDocRef = doc(collection(db, 'feedback'));
    await setDoc(feedbackDocRef, {
      uid,
      name,
      email,
      rating: Number(rating),
      message,
      createdAt: new Date().toISOString()
    });
    return { success: true };
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

