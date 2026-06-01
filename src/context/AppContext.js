import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  apiGetMe, apiLogout, setToken, clearToken,
  apiGetFavorites, apiAddFavoriteFood, apiRemoveFavoriteFood,
  apiUpdatePreferences,
} from '../services/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';

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

  // ── Rehydrate session on mount ───────────────────────
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            setToken(token);
            const data = await apiGetMe();
            setUserState(data.user);
            if (data.user?.preferences) setPreferencesState(data.user.preferences);
            const favData = await apiGetFavorites();
            if (favData) {
              setSavedFoodObjects(favData.favoriteFoods || []);
              setFavorites({
                foods: (favData.favoriteFoods || []).map(f => f.foodId),
              });
            }
          } catch (e) {
            console.error('Session sync error:', e);
            clearToken();
          } finally {
            setAuthLoading(false);
          }
        } else {
          setUserState(null);
          clearToken();
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
            if (data.user?.preferences) setPreferencesState(data.user.preferences);
            return apiGetFavorites();
          })
          .then(favData => {
            if (favData) {
              setSavedFoodObjects(favData.favoriteFoods || []);
              setFavorites({
                foods: (favData.favoriteFoods || []).map(f => f.foodId),
              });
            }
          })
          .catch(() => clearToken())
          .finally(() => setAuthLoading(false));
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
      setFavorites({ foods: [] });
      setSavedFoodObjects([]);
      return;
    }
    setUserState(userData);
    if (userData.preferences) setPreferencesState(userData.preferences);
  }

  // ── Partial update user fields (e.g. after profile edit) ──────────
  function updateUser(fields) {
    setUserState(prev => prev ? { ...prev, ...fields } : prev);
  }

  // ── Update preferences (local + backend) ─────────────
  async function setPreferences(prefs) {
    setPreferencesState(prefs);
    if (user) {
      try { await apiUpdatePreferences(prefs); } catch (e) { console.warn('Pref sync failed', e); }
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

  async function checkVerificationStatus() {
    return true;
  }

  return (
    <AppContext.Provider value={{
      user, setUser, updateUser, authLoading,
      preferences, setPreferences,
      favorites, toggleFavoriteFood,
      savedFoodObjects, saveFoodObject, removeSavedFoodObject,
      darkMode, setDarkMode,
      cart, addToCart, removeFromCart,
      notifications, markAllAsRead, clearNotification,
      emailVerified: true, setEmailVerified: () => {}, checkVerificationStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
