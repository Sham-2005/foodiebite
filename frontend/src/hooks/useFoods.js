// ─────────────────────────────────────────────────────────────
//  hooks/useFoods.js
//  Reusable hook that manages fetch state for food data
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRecommendations, searchByQuery } from '../services/openFoodFacts';
import { getWeatherContext } from '../services/weather';
import { useApp } from '../context/AppContext';

export function useWeatherContext() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const context = await getWeatherContext();
      setWeather(context);
    } catch (e) {
      setError(e.message || 'Weather unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { weather, loading, error, reload: load };
}

// In-memory cache with timestamp for Stale-While-Revalidate recommendations
let cachedRecommendations = null;
let cachedRecommendationsTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh window

// ── Hook: personalised recommendations ──────────────────────
export function useRecommendations(preferences, count = 20, weather = null) {
  const [foods,   setFoods]   = useState(cachedRecommendations || []);
  const [loading, setLoading] = useState(!cachedRecommendations || cachedRecommendations.length === 0);
  const [error,   setError]   = useState(null);

  // Keep a ref to the latest weather to use in fetches, without triggering auto-refresh
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  const load = useCallback(async (isManual = false) => {
    if (!preferences?.dietType) return;
    
    const now = Date.now();
    const isFresh = (now - cachedRecommendationsTimestamp) < CACHE_TTL_MS;

    // Fast path: if we have cached recommendations, display immediately
    if (!isManual && cachedRecommendations && cachedRecommendations.length > 0) {
      setFoods(cachedRecommendations);
      setLoading(false);
      // If still within fresh window, skip background re-fetch
      if (isFresh) return;
    } else if (!cachedRecommendations || cachedRecommendations.length === 0) {
      setLoading(true);
    }

    setError(null);
    try {
      const results = await getRecommendations({ ...preferences, weather: weatherRef.current }, count);
      if (results && results.length > 0) {
        setFoods(results);
        cachedRecommendations = results;
        cachedRecommendationsTimestamp = Date.now();
      } else {
        const { LOCAL_PRODUCTS } = await import('../services/openFoodFacts');
        setFoods(LOCAL_PRODUCTS.slice(0, count));
      }
    } catch (e) {
      console.warn('Failed to load recommendations from proxy:', e);
      try {
        const { LOCAL_PRODUCTS } = await import('../services/openFoodFacts');
        setFoods(LOCAL_PRODUCTS.slice(0, count));
      } catch (err) {
        if (!cachedRecommendations || cachedRecommendations.length === 0) {
          setError('Failed to load recommendations. Please check connection.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [preferences?.dietType, count]);

  // Run only on mount, or when primary diet preferences change
  useEffect(() => {
    load(false);
  }, [preferences?.dietType]);

  return { foods, loading, error, reload: () => load(true) };
}

// ── Hook: random products for discovery ──────────────────────
const RANDOM_TERMS = [
  'chicken', 'salad', 'quinoa', 'tofu', 'oats', 'paneer', 'lentils',
  'yogurt', 'eggs', 'avocado', 'pasta', 'rice', 'almond', 'banana',
  'cheese', 'bread', 'granola', 'soup', 'chocolate', 'protein bar',
  'smoothie', 'cereal', 'fruit', 'vegetable', 'soy milk',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let cachedRandomProducts = null;

export function useRandomProducts(count = 12) {
  const [foods,   setFoods]   = useState(cachedRandomProducts || []);
  const [loading, setLoading] = useState(!cachedRandomProducts);
  const { preferences } = useApp();
  const country = preferences?.country || 'in';

  const load = useCallback(async (isManual = false) => {
    // Use cache on auto-load if available
    if (!isManual && cachedRandomProducts && cachedRandomProducts.length > 0) {
      setFoods(cachedRandomProducts);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Pick 3 random terms to get a diverse set
      const picked = shuffle(RANDOM_TERMS).slice(0, 3);
      const { searchFoods, normaliseProduct } = await import('../services/openFoodFacts');
      const rawArrays = await Promise.all(picked.map(t => searchFoods(t, 10, country)));
      const rawAll = rawArrays.flat();

      // Deduplicate
      const seen = new Set();
      const unique = rawAll.filter(p => {
        const key = p.id || p._id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const normalised = unique.map(normaliseProduct).filter(Boolean)
        .filter(p => p.name && p.calories > 0);
      const shuffled = shuffle(normalised).slice(0, count);

      setFoods(shuffled);
      cachedRandomProducts = shuffled;
    } catch {
      // Silently fail — the section just won't show
    } finally {
      setLoading(false);
    }
  }, [count, country]);

  useEffect(() => { load(false); }, [load, country]);

  return { foods, loading, reload: () => load(true) };
}

// ── Hook: search query ───────────────────────────────────────
export function useSearch(query, preferences) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await searchByQuery(query, preferences || {}, 25);
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setError('Search failed. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, preferences]);

  return { results, loading, error };
}
