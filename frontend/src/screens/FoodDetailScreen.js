import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Heart, ExternalLink, Check, Flame } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { BtnOrange, GradeBadge, MacroChip, TagPill, FoodImageFallback, C, HealthScoreCard } from '../components/UI';
import { getProductById, gradeColor, normaliseProduct } from '../services/openFoodFacts';
import { resolveFoodImage, getCuratedFallbackImage, resolveFoodGrade } from '../services/foodHelpers';
import { apiGetDeliveryLink, apiLogMeal } from '../services/api';
import { trackViewedFood, trackSelectedRecommendation } from '../services/localStorageService';
import { trackFoodDetailView } from '../services/analyticsEventService';

const GRADE_DESC = {
  a: 'Excellent nutritional quality',
  b: 'Good nutritional quality',
  c: 'Average nutritional quality',
  d: 'Poor nutritional quality',
  e: 'Very poor nutritional quality',
};

export default function FoodDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params || {};
  const initialFood = route.params?.food || null;

  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject, preferences } = useApp();
  const [food, setFood] = useState(initialFood);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [loading, setLoading] = useState(!initialFood);
  const [error, setError] = useState('');
  const [loggedToast, setLoggedToast] = useState(false);

  const resolvedImg = resolveFoodImage(food);
  const [heroImg, setHeroImg] = useState(resolvedImg);
  const [triedFallback, setTriedFallback] = useState(false);
  const [imgFailed, setImgFailed] = useState(!resolvedImg);

  useEffect(() => {
    const res = resolveFoodImage(food);
    setHeroImg(res);
    setTriedFallback(false);
    setImgFailed(!res);
  }, [food?.id, food?.foodId, food?.image, food?.imageUrl, food?.image_url]);

  const handleHeroImgError = () => {
    if (!triedFallback) {
      const fb = getCuratedFallbackImage(food);
      if (fb && fb !== heroImg) {
        setTriedFallback(true);
        setHeroImg(fb);
        return;
      }
    }
    setImgFailed(true);
  };

  // Track viewed food and recommendation selections
  useEffect(() => {
    if (food) {
      trackViewedFood(food);
      trackFoodDetailView(food, {
        recommendationStrategy: food.recommendationStrategy || (food.isRecommendation ? 'context_aware' : 'general'),
        experimentId: food.experimentId,
        variantId: food.variantId
      });
      if (food.isRecommendation) {
        trackSelectedRecommendation(food.id || food.foodId, food);
      }
    }
  }, [food]);

  async function handleAddToDietLog() {
    try {
      const meal = {
        foodId: food.id,
        name: food.name,
        calories: food.calories || 0,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
        sodium: food.sodium || 0,
        sugar: food.sugar || 0,
        healthScore: food.healthScore || 5.0,
        mealType: 'snack'
      };
      await apiLogMeal(meal);
      setLoggedToast(true);
      setTimeout(() => setLoggedToast(false), 2500);
    } catch (err) {
      console.error('Failed to write meal log to Firestore:', err.message);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFood() {
      if (initialFood) {
        setFood(initialFood);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const product = await getProductById(id);
      if (cancelled) return;

      const normalised = normaliseProduct(product);
      if (normalised) {
        setFood(normalised);
      } else {
        setError('Food details not available.');
      }
      setLoading(false);
    }

    loadFood();
    return () => { cancelled = true; };
  }, [id, initialFood]);

  useEffect(() => {
    let cancelled = false;

    async function loadDelivery() {
      if (!food?.name) return;

      try {
        const data = await apiGetDeliveryLink(food.name);
        if (!cancelled) {
          setDeliveryOptions(data.deliveryOptions || (data.delivery ? [data.delivery] : []));
        }
      } catch {
        if (!cancelled) {
          setDeliveryOptions([
            {
              provider: 'Swiggy Instamart',
              mode: 'search',
              url: `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(food.name)}`,
              label: 'Search on Swiggy Instamart',
            },
            {
              provider: 'Blinkit',
              mode: 'search',
              url: 'https://blinkit.com/s/',
              label: 'Open Blinkit search',
            },
            {
              provider: 'BigBasket',
              mode: 'search',
              url: 'https://www.bigbasket.com/search/',
              label: 'Open BigBasket search',
            },
            {
              provider: 'Zepto',
              mode: 'search',
              url: `https://www.zepto.com/search?query=${encodeURIComponent(food.name)}`,
              label: 'Search on Zepto',
            },
          ]);
        }
      }
    }

    loadDelivery();
    return () => { cancelled = true; };
  }, [food]);

  const isFav = food ? favorites.foods.includes(food.id) : false;

  function handleFav() {
    if (!food) return;
    isFav ? removeSavedFoodObject(food.id) : saveFoodObject(food);
    toggleFavoriteFood(food.id, food);
  }

  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  if (loading || !food) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 40 }}>🍽️</Text>
        <Text style={{ color: '#888', marginTop: 12 }}>
          {loading ? 'Loading food details...' : error || 'Food details not available.'}
        </Text>
        {!loading && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: C.orange, fontWeight: '700' }}>← Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const grade = resolveFoodGrade(food);
  const gColor = gradeColor(grade);

  const userAllergies = (preferences?.allergies || []).map(a => String(a).toLowerCase().trim());
  const matchingAllergens = (food?.allergens || []).filter(a => {
    const clean = a.replace('en:', '').replace(/-/g, ' ').toLowerCase();
    return userAllergies.some(ua => clean.includes(ua) || ua.includes(clean));
  });

  return (
    <View style={styles.mainContainer}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          {heroImg && !imgFailed ? (
            <Image 
              source={{ uri: heroImg }} 
              onError={handleHeroImgError}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <FoodImageFallback name={food?.name} height={220} />
          )}
          <View style={styles.gradientOverlay} />

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={{ color: '#fff', fontSize: 17 }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFav} style={styles.favBtn}>
            <Heart size={18} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.titleRow}>
            <Text style={styles.foodTitle}>{food.name}</Text>
            <GradeBadge grade={grade} style={{ marginTop: 3 }} />
          </View>

          {matchingAllergens.length > 0 ? (
            <View style={styles.allergenAlertCard}>
              <Text style={styles.allergenAlertTitle}>⚠️ Allergy Conflict Detected</Text>
              <Text style={styles.allergenAlertText}>
                Contains {matchingAllergens.map(a => a.replace('en:', '').replace(/-/g, ' ')).join(', ')}, which matches your saved allergy profile!
              </Text>
            </View>
          ) : null}

          {grade && grade !== 'unknown' ? (
            <View style={[styles.gradeBanner, { backgroundColor: `${gColor}18`, borderColor: `${gColor}44` }]}>
              <View style={[styles.gradeDot, { backgroundColor: gColor }]} />
              <Text style={[styles.gradeBannerText, { color: gColor }]}>
                {GRADE_DESC[grade] || 'Nutrition grade: ' + grade.toUpperCase()}
              </Text>
            </View>
          ) : null}

          {food.quantity ? (
            <Text style={styles.packageText}>Package: {food.quantity}</Text>
          ) : null}

          {deliveryOptions.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.subSectionTitle}>Order on delivery apps</Text>
              <View style={styles.deliveryGrid}>
                {deliveryOptions.map((option) => (
                  <TouchableOpacity
                    key={option.provider}
                    onPress={() => openLink(option.url)}
                    style={styles.deliveryCard}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deliveryProvider} numberOfLines={1}>{option.provider}</Text>
                      <Text style={styles.deliveryLabel} numberOfLines={1}>{option.label}</Text>
                    </View>
                    <ExternalLink size={16} color={C.orange} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Macros */}
          <View style={styles.macrosRow}>
            <MacroChip label="Calories" value={food.calories} unit="kcal" />
            <MacroChip label="Protein" value={food.protein} unit="g" />
            <MacroChip label="Carbs" value={food.carbs} unit="g" />
            <MacroChip label="Fat" value={food.fat} unit="g" />
          </View>

          {/* Health Score calculation card */}
          <HealthScoreCard food={food} style={{ marginBottom: 20 }} />

          {/* AI Recommendation Transparency Card */}
          {(food?.recommendationScore !== undefined || food?.explanation || (Array.isArray(food?.contextualReasons) && food.contextualReasons.length > 0)) ? (
            <View style={styles.aiRecommendationCard}>
              <View style={styles.aiRecommendationHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>✨</Text>
                  <Text style={styles.aiRecommendationTitle}>AI Match Intelligence</Text>
                </View>
                {food.recommendationScore !== undefined ? (
                  <View style={styles.matchScoreBadge}>
                    <Text style={styles.matchScoreText}>{food.recommendationScore}% Match</Text>
                  </View>
                ) : null}
              </View>

              {Array.isArray(food?.contextualReasons) && food.contextualReasons.length > 0 ? (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {food.contextualReasons.slice(0, 4).map((reason, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: C.orange, fontSize: 13, lineHeight: 18 }}>•</Text>
                      <Text style={styles.aiReasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              ) : food?.explanation ? (
                <Text style={[styles.aiReasonText, { marginTop: 6 }]}>
                  {food.explanation}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Per 100g Nutrition Breakdown */}
          {(food.fiber > 0 || food.sugar > 0 || food.sodium > 0) ? (
            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionCardTitle}>Full Nutrition (per 100g)</Text>
              <View style={{ gap: 8 }}>
                {food.fiber > 0 ? <NutrientRow label="Fiber" value={`${food.fiber}g`} color="#43a047" /> : null}
                {food.sugar > 0 ? <NutrientRow label="Sugar" value={`${food.sugar}g`} color="#e53935" /> : null}
                {food.sodium > 0 ? <NutrientRow label="Sodium" value={`${food.sodium}mg`} color="#1e88e5" /> : null}
              </View>
            </View>
          ) : null}

          {food.labels?.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.subSectionTitle}>Labels & Certifications</Text>
              <View style={styles.tagsContainer}>
                {food.labels.slice(0, 8).map(l => (
                  <TagPill key={l} label={l.replace('en:', '').replace(/-/g, ' ')} />
                ))}
              </View>
            </View>
          ) : null}

          {food.allergens?.length > 0 ? (
            <View style={styles.allergenCard}>
              <Text style={styles.allergenTitle}>Contains Allergens</Text>
              <View style={styles.tagsContainer}>
                {food.allergens.map(a => (
                  <View key={a} style={styles.allergenBadge}>
                    <Text style={styles.allergenText}>
                      {a.replace('en:', '').replace(/-/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.footerInfo}>
            <Text style={{ fontSize: 11, color: '#555' }}>Source: Open Food Facts</Text>
            <ExternalLink size={11} color="#555" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </ScrollView>

      {/* Floating Success Toast */}
      {loggedToast ? (
        <View style={styles.toastContainer}>
          <Check size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>Logged {food.calories} kcal to your daily diet!</Text>
        </View>
      ) : null}

      {/* Fixed Footer Actions */}
      <View style={styles.fixedFooterWrapper}>
        <View style={styles.fixedFooter}>
          <TouchableOpacity
            onPress={handleFav}
            style={styles.fixedFavBtn}
          >
            <Heart size={20} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#ccc'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAddToDietLog}
            style={styles.fixedLogBtn}
          >
            <Flame size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.fixedLogText}>Add to Diet Tracker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function NutrientRow({ label, value, color }) {
  return (
    <View style={styles.nutrientRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.nutrientDot, { backgroundColor: color }]} />
        <Text style={{ fontSize: 13, color: '#ccc' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#111318',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 80,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  heroContainer: {
    position: 'relative',
    height: 240,
    width: '100%',
    backgroundColor: '#1e1e1e',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', // Simulated linear gradient bottom/top
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    marginBottom: 10,
  },
  foodTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 26,
  },
  gradeBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gradeBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  deliveryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  deliveryProvider: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 3,
  },
  deliveryLabel: {
    fontSize: 11,
    color: C.muted,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  nutritionCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  nutritionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutrientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  allergenCard: {
    backgroundColor: 'rgba(229,57,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  allergenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b6b',
    marginBottom: 8,
  },
  allergenBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(229,57,53,0.15)',
  },
  allergenText: {
    color: '#ff6b6b',
    fontSize: 11,
    fontWeight: '600',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: C.border,
    marginTop: 8,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#1e8a3e',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
      }
    }),
    zIndex: 2000,
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  fixedFooterWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: '#111318',
    borderTopWidth: 1,
    borderColor: C.border,
    zIndex: 1000,
  },
  fixedFooter: {
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fixedFavBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedLogBtn: {
    flex: 1,
    backgroundColor: C.orange,
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedLogText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  allergenAlertCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  allergenAlertTitle: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  allergenAlertText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 17,
  },
  aiRecommendationCard: {
    backgroundColor: '#181a20',
    borderColor: '#ff7a0033',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  aiRecommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aiRecommendationTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  matchScoreBadge: {
    backgroundColor: '#ff7a001a',
    borderColor: '#ff7a0055',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchScoreText: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '800',
  },
  aiReasonText: {
    flex: 1,
    color: '#bbb',
    fontSize: 12,
    lineHeight: 18,
  },
});
