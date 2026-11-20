import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiGetMe, apiLogout, setToken, clearToken, clearAdminSession,
  apiGetFavorites, apiAddFavoriteFood, apiRemoveFavoriteFood,
  apiUpdatePreferences, apiSyncUser, getLocalActiveUser, saveLocalActiveUser,
} from '../services/api';
import { onAuthStateChange as onSupabaseAuthStateChange, getCurrentSession as getSupabaseCurrentSession } from '../services/supabaseAuthService';
import { getMyProfile as getSupabaseMyProfile } from '../services/supabaseProfileService';
import { isSupabaseConfigured, getSupabaseClient } from '../config/supabaseClient';
import {
  saveSession,
  getSession,
  clearSession,
  savePreferences,
  getPreferences,
  refreshSessionExpiration
} from '../services/localStorageService';
import storage, { getItemSync, removeItemSync, removeItem } from '../services/storage';

const DEFAULT_PREFERENCES = {
  dietType: 'Vegetarian',
  spiceLevel: 'Medium',
  cuisines: ['indian'],
  healthGoals: ['healthy_eating'],
  country: 'in',
  allergies: [],
  fasting: { active: false, type: null, allowedCategories: [], restrictedCategories: [] },
  maxCalories: null,
  minProtein: null,
  minGrade: 'c',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [preferences, setPreferencesState] = useState(DEFAULT_PREFERENCES);

  const [favorites, setFavorites] = useState({ foods: [] });
  const [savedFoodObjects, setSavedFoodObjects] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [cart, setCart] = useState([]);

  const [notifications, setNotifications] = useState([
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
  useEffect(() => {
    const cachedSession = getSession() || getLocalActiveUser();
    if (cachedSession) {
      // Defensively purge any legacy mock session to prevent accidental restoration
      if (
        cachedSession.isMock ||
        /mock.*@|mockuser/i.test(cachedSession.email || '') ||
        /mock-google-|mock-token-/i.test(cachedSession.id || cachedSession.token || '')
      ) {
        clearSession();
        removeItemSync('nb_mock_active');
        removeItemSync('nb_active_user');
        setAuthLoading(false);
        return;
      }

      const isCompleted = Boolean(cachedSession.profileCompleted || (cachedSession.age && cachedSession.gender));
      setUserState({
        id: cachedSession.uid || cachedSession.id,
        uid: cachedSession.uid || cachedSession.id,
        name: cachedSession.displayName || cachedSession.name,
        email: cachedSession.email,
        role: cachedSession.role || ((cachedSession.email || '').toLowerCase() === 'sham111205s@gmail.com' ? 'admin' : 'user'),
        age: cachedSession.age || null,
        gender: cachedSession.gender || null,
        profileCompleted: isCompleted,
        preferences: cachedSession.preferences || getPreferences() || preferences
      });
      const cachedPrefs = cachedSession.preferences || getPreferences();
      if (cachedPrefs) {
        setPreferencesState(cachedPrefs);
      }
      setAuthLoading(false);
    }
  }, []);

  // ── Rehydrate session on mount (Supabase Auth) ────────────────
  useEffect(() => {
    if (isSupabaseConfigured) {
      // 1. Initial check for existing active session
      getSupabaseCurrentSession().then(async (res) => {
        if (res?.session?.user) {
          try {
            setToken(res.session.access_token);
            const pRes = await getSupabaseMyProfile();
            const profile = pRes?.profile;
            if (profile && (profile.disabled === true || profile.account_status === 'disabled')) {
              await logout();
              return;
            }
            const cleanEmail = (res.session.user.email || '').trim().toLowerCase();
            const fullUser = {
              id: res.session.user.id,
              uid: res.session.user.id,
              name: profile?.name || res.session.user.user_metadata?.full_name || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
              email: cleanEmail,
              role: profile?.role || (cleanEmail === 'sham111205s@gmail.com' ? 'admin' : 'user'),
              age: profile?.age || null,
              gender: profile?.gender || null,
              dietType: profile?.diet_type || 'Vegetarian',
              preferences: profile?.preferences || preferences,
              profileCompleted: !!(profile?.age && profile?.gender),
              disabled: profile?.disabled || false,
              accountStatus: profile?.account_status || 'active',
            };
            setUserState(fullUser);
            saveLocalActiveUser(fullUser);
            saveSession({ ...fullUser, token: res.session.access_token });
            if (fullUser.preferences) {
              setPreferencesState(fullUser.preferences);
              savePreferences(fullUser.preferences);
            }
          } catch (e) {
            console.error('Supabase initial session sync error:', e);
          } finally {
            setAuthLoading(false);
          }
        } else {
          setAuthLoading(false);
        }
      }).catch(() => setAuthLoading(false));

      // 2. Subscribe to Supabase Auth state changes
      const subscription = onSupabaseAuthStateChange(async (event, session) => {
        if (session && session.user) {
          try {
            setToken(session.access_token);
            const pRes = await getSupabaseMyProfile();
            const profile = pRes?.profile;
            if (profile && (profile.disabled === true || profile.account_status === 'disabled')) {
              await logout();
              return;
            }
            const cleanEmail = (session.user.email || '').trim().toLowerCase();
            const fullUser = {
              id: session.user.id,
              uid: session.user.id,
              name: profile?.name || session.user.user_metadata?.full_name || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
              email: cleanEmail,
              role: profile?.role || (cleanEmail === 'sham111205s@gmail.com' ? 'admin' : 'user'),
              age: profile?.age || null,
              gender: profile?.gender || null,
              dietType: profile?.diet_type || 'Vegetarian',
              preferences: profile?.preferences || preferences,
              profileCompleted: !!(profile?.age && profile?.gender),
              disabled: profile?.disabled || false,
              accountStatus: profile?.account_status || 'active',
            };
            setUserState(fullUser);
            setAuthLoading(false);
            saveLocalActiveUser(fullUser);
            saveSession({ ...fullUser, token: session.access_token });
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
            }).catch(() => { });
          } catch (e) {
            console.error('Supabase auth state sync error:', e);
            setAuthLoading(false);
          }
        } else if (event === 'SIGNED_OUT' || !session) {
          setUserState(null);
          clearToken();
          clearSession();
          setFavorites({ foods: [] });
          setSavedFoodObjects([]);
          setAuthLoading(false);
        }
      });

      return () => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      };
    } else {
      const token = getItemSync('nb_token');
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
            }).catch(() => { });
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

  // ── Supabase Realtime Cross-Platform Sync ────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    const client = getSupabaseClient();
    if (!client || typeof client.channel !== 'function') return;

    // 1. Listen for changes to current user's profile (edits, disabled status, remote deletion)
    const profileChannel = client
      .channel(`realtime_profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            console.log('🔔 [Realtime] User profile deleted remotely — signing out');
            logout();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            console.log('🔔 [Realtime] Profile updated remotely — synchronizing state');
            if (payload.new.disabled === true || payload.new.account_status === 'disabled') {
              logout();
            } else {
              updateUser({
                name: payload.new.name || payload.new.full_name,
                dietType: payload.new.diet_type,
                age: payload.new.age,
                gender: payload.new.gender,
                preferences: payload.new.preferences || preferences
              });
            }
          }
        }
      )
      .subscribe();

    // 2. Listen for changes to current user's saved favorites
    const favChannel = client
      .channel(`realtime_favs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_favorites',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('🔔 [Realtime] Favorites updated remotely — refreshing favorites');
          apiGetFavorites().then(favData => {
            if (favData) {
              setSavedFoodObjects(favData.favoriteFoods || []);
              setFavorites({
                foods: (favData.favoriteFoods || []).map(f => f.foodId),
              });
            }
          }).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      try {
        if (client.removeChannel) {
          client.removeChannel(profileChannel);
          client.removeChannel(favChannel);
        }
      } catch (_) {}
    };
  }, [user?.id]);

  // ── Set user after login/register ────────────────────
  const setUser = useCallback((userData) => {
    if (!userData) {
      setUserState(null);
      clearToken();
      clearSession();
      setFavorites({ foods: [] });
      setSavedFoodObjects([]);
      setPreferencesState(DEFAULT_PREFERENCES);
      return;
    }
    setUserState(userData);
    saveLocalActiveUser(userData);
    saveSession(userData);
    if (userData.preferences) {
      setPreferencesState(userData.preferences);
      savePreferences(userData.preferences);
    }
  }, []);

  // ── Logout and clear all storage ─────────────────────
  async function logout() {
    try {
      await apiLogout();
    } catch (_) { }
    setUserState(null);
    clearToken();
    clearSession();
    clearAdminSession();
    try {
      await Promise.all([
        removeItem('nb_token'),
        removeItem('nb_active_session'),
        removeItem('nb_active_user'),
        removeItem('nb_mock_active'),
        removeItem('foodiebite_admin_session'),
        removeItem('foodiebite_redirect_after_login'),
      ]);
    } catch (err) {
      console.warn('[AppContext] Storage removal notice on logout:', err?.message || err);
    }
    removeItemSync('nb_token');
    removeItemSync('nb_active_session');
    removeItemSync('nb_active_user');
    removeItemSync('nb_mock_active');
    removeItemSync('foodiebite_admin_session');
    removeItemSync('foodiebite_redirect_after_login');
    setFavorites({ foods: [] });
    setSavedFoodObjects([]);
    setPreferencesState(DEFAULT_PREFERENCES);
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
      emailVerified: true, setEmailVerified: () => { }, checkVerificationStatus,
      nearbyTrigger, setNearbyTrigger,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
