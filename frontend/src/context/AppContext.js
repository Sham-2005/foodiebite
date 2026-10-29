import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  apiGetMe, apiLogout, setToken, clearToken, clearAdminSession,
  apiGetFavorites, apiAddFavoriteFood, apiRemoveFavoriteFood,
  apiUpdatePreferences, apiSyncUser,
} from '../services/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import {
  saveSession,
  getSession,
  clearSession,
  savePreferences,
  getPreferences,
  refreshSessionExpiration
} from '../services/localStorageService';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user,        setUserState]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [preferences, setPreferencesState] = useState({
    dietType:    'Vegetarian',
    spiceLevel:  'Medium',
    cuisines:    ['indian'],
    healthGoals: ['healthy_eating'],
    country:     'in',
    allergies:   [],
    fasting:     { active: false, type: null, allowedCategories: [], restrictedCategories: [] },
    maxCalories: null,
    minProtein:  null,
    minGrade:    'c',
  });

  const [favorites,         setFavorites]         = useState({ foods: [] });
  const [savedFoodObjects,  setSavedFoodObjects]  = useState([]);
  const [darkMode,          setDarkMode]          = useState(true);
  const [cart,              setCart]              = useState([]);

  const [notifications,     setNotifications]     = useState([
    {
      id: 1,
      title: 'Welcome to FoodieBite! 🍏',
      message: 'Start tracking your meals and configure your diet preferences in the profile tab.',
      time: 'Just now',
      read: false,
      type: 'welcome'
    },
    {
      id: 2,
      title: 'Seasonal Recommendations 🌦️',
      message: 'It is currently a warm season! We have updated your recommendations with fresh, light foods.',
      time: '1 hour ago',
      read: false,
      type: 'weather'
    },
    {
      id: 3,
      title: 'Protein Density Update 💪',
      message: 'New High Protein Picks have been curated based on your health goals.',
      time: '2 hours ago',
      read: false,
      type: 'goal'
    }
  ]);

  function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearNotification(id) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  // ── Instant Offline Rehydration ──────────────────────
  // Runs synchronously before Firebase onAuthStateChanged fires.
  // Must restore age/gender so VerificationGuard doesn't redirect
  // to /complete-profile during the Firebase auth loading window.
  useEffect(() => {
    const cachedSession = getSession();
    if (cachedSession) {
      setUserState({
        id:               cachedSession.uid,
        uid:              cachedSession.uid,
        name:             cachedSession.displayName,
        email:            cachedSession.email,
        // Restore physical profile fields saved by saveSession()
        age:              cachedSession.age   || null,
        gender:           cachedSession.gender || null,
        profileCompleted: cachedSession.profileCompleted || false,
        preferences:      getPreferences() || preferences
      });
      const cachedPrefs = getPreferences();
      if (cachedPrefs) {
        setPreferencesState(cachedPrefs);
      }
      setAuthLoading(false);
    }
  }, []);

  // ── Rehydrate session on mount (Firebase and API sync) ────────────────
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            setToken(token);
            const data = await apiGetMe();

            // Compute profileCompleted so VerificationGuard and saveSession()
            // always have it, even if the backend doesn't return it explicitly.
            const fullUser = {
              ...data.user,
              profileCompleted: !!(data.user?.age && data.user?.gender),
            };

            setUserState(fullUser);
            setAuthLoading(false);

            // Reconcile user with admin directory in background
            apiSyncUser(fullUser).catch(err => console.warn('Directory auto-reconcile note:', err.message));

            // Save session to offline cache
            saveSession({ ...fullUser, token });
            if (fullUser.preferences) {
              setPreferencesState(fullUser.preferences);
              savePreferences(fullUser.preferences);
            }

            // Load favorites asynchronously without blocking UI
            apiGetFavorites().then(favData => {
              if (favData) {
                setSavedFoodObjects(favData.favoriteFoods || []);
                setFavorites({
                  foods: (favData.favoriteFoods || []).map(f => f.foodId),
                });
              }
            }).catch(() => {});
          } catch (e) {
            console.error('Session sync error:', e);
            clearToken();
            clearSession();
            setAuthLoading(false);
          }
        } else {
          const token = localStorage.getItem('nb_token');
          if (token) {
            try {
              const data = await apiGetMe();
              if (data && data.user) {
                setUserState(data.user);
                saveSession({ ...data.user, token });
                setAuthLoading(false);
                return;
              }
            } catch (_) {}
          }
          setUserState(null);
          clearToken();
          clearSession();
          setFavorites({ foods: [] });
          setSavedFoodObjects([]);
          setAuthLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      const token = localStorage.getItem('nb_token');
      if (token) {
        apiGetMe()
          .then(data => {
            setUserState(data.user);
            setAuthLoading(false);
            saveSession({ ...data.user, token });
            if (data.user?.preferences) {
              setPreferencesState(data.user.preferences);
              savePreferences(data.user.preferences);
            }
            apiGetFavorites().then(favData => {
              if (favData) {
                setSavedFoodObjects(favData.favoriteFoods || []);
                setFavorites({
                  foods: (favData.favoriteFoods || []).map(f => f.foodId),
                });
              }
            }).catch(() => {});
          })
          .catch(() => {
            clearToken();
            clearSession();
            setAuthLoading(false);
          });
      } else {
        setAuthLoading(false);
      }
    }
  }, []);

  // ── Set user after login/register ────────────────────
  function setUser(userData) {
    if (!userData) {
      setUserState(null);
      clearToken();
      clearSession();
      setFavorites({ foods: [] });
      setSavedFoodObjects([]);
      return;
    }
    setUserState(userData);
    saveSession(userData);
    if (userData.preferences) {
      setPreferencesState(userData.preferences);
      savePreferences(userData.preferences);
    }
  }

  // ── Logout and clear all storage ─────────────────────
  async function logout() {
    try {
      await apiLogout();
    } catch (_) {}
    setUserState(null);
    clearToken();
    clearSession();
    clearAdminSession();
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
    setFavorites({ foods: [] });
    setSavedFoodObjects([]);
  }

  // ── Partial update user fields (e.g. after profile edit) ──────────
  function updateUser(fields) {
    setUserState(prev => {
      const updated = prev ? { ...prev, ...fields } : prev;
      if (updated) {
        saveSession(updated);
        if (updated.preferences) savePreferences(updated.preferences);
      }
      return updated;
    });
  }

  // ── Update preferences (local + backend) ─────────────
  async function setPreferences(prefs) {
    const merged = { ...preferences, ...prefs };
    setPreferencesState(merged);
    savePreferences(merged);
    if (user) {
      try { await apiUpdatePreferences(merged); } catch (e) { console.warn('Pref sync failed', e); }
    }
  }

  // ── Toggle food favorite ──────────────────────────────
  async function toggleFavoriteFood(id, foodObject = null) {
    const isFav = favorites.foods.includes(id);
    // Optimistic update
    setFavorites(prev => ({
      ...prev,
      foods: isFav ? prev.foods.filter(f => f !== id) : [...prev.foods, id],
    }));
    // Sync to backend if logged in
    if (user) {
      try {
        if (isFav) await apiRemoveFavoriteFood(id);
        else {
          const food = foodObject || savedFoodObjects.find(f => f.id === id || f.foodId === id);
          if (food) await apiAddFavoriteFood({ ...food, id: food.foodId || food.id });
        }
      } catch (e) {
        console.warn('Favorite sync failed', e);
        // Revert on failure
        setFavorites(prev => ({
          ...prev,
          foods: isFav ? [...prev.foods, id] : prev.foods.filter(f => f !== id),
        }));
      }
    }
  }

  // ── Save full food object ─────────────────────────────
  function saveFoodObject(food) {
    setSavedFoodObjects(prev =>
      prev.find(f => (f.id || f.foodId) === (food.id || food.foodId)) ? prev : [...prev, food]
    );
  }

  function removeSavedFoodObject(id) {
    setSavedFoodObjects(prev => prev.filter(f => (f.id || f.foodId) !== id));
  }

  // ── Cart ─────────────────────────────────────────────
  function addToCart(food) {
    setCart(prev => {
      const existing = prev.find(i => i.id === food.id);
      if (existing) return prev.map(i => i.id === food.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...food, qty: 1 }];
    });
  }
  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const [nearbyTrigger, setNearbyTrigger] = useState(null);

  async function checkVerificationStatus() {
    return true;
  }

  return (
    <AppContext.Provider value={{
      user, setUser, updateUser, logout, authLoading,
      preferences, setPreferences,
      favorites, toggleFavoriteFood,
      savedFoodObjects, saveFoodObject, removeSavedFoodObject,
      darkMode, setDarkMode,
      cart, addToCart, removeFromCart,
      notifications, markAllAsRead, clearNotification,
      emailVerified: true, setEmailVerified: () => {}, checkVerificationStatus,
      nearbyTrigger, setNearbyTrigger,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
