import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Search, SlidersHorizontal, RefreshCw, CloudRain, MapPin, Thermometer, X, Trash2, Check, Sparkles, AlertCircle, Scale, ArrowRight, Zap } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { FoodCardH, SectionHeader, SkeletonCard, ErrorState, C, MoodSelector } from '../components/UI';
import { useRecommendations, useWeatherContext } from '../hooks/useFoods';
import { describeWeatherContext } from '../services/weather';
import { apiGetMoodRecommendations } from '../services/api';
import { collection, query, where, onSnapshot } from '../services/firebase';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
import { getFrequentItems } from '../services/localStorageService';
import { filterByCategory } from '../services/foodHelpers';
import { trackRecommendationImpression } from '../services/analyticsEventService';

const DIET_CATEGORIES = [
  { id: 'all',      label: 'All',       emoji: '🍽️' },
  { id: 'healthy',  label: 'Healthy',   emoji: '🥗' },
  { id: 'protein',  label: 'Protein',   emoji: '💪' },
  { id: 'lowcarb',  label: 'Low Carb',  emoji: '🥑' },
  { id: 'vegan',    label: 'Vegan',     emoji: '🌱' },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, preferences, notifications, markAllAsRead, clearNotification } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeMood, setActiveMood] = useState(null);
  const [moodFoods, setMoodFoods] = useState([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [deficiencies, setDeficiencies] = useState([]);
  const [frequentFoods, setFrequentFoods] = useState([]);

  const { weather, loading: weatherLoading, error: weatherError, reload: reloadWeather } = useWeatherContext();
  const { foods, loading, error, reload } = useRecommendations(preferences, 30, weather);

  // If the authorized administrator opens HomeScreen, immediately redirect to /admin
  useEffect(() => {
    if ((user?.email || '').trim().toLowerCase() === 'sham111205s@gmail.com') {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/admin';
      } else {
        navigation.replace('Admin');
      }
    }
  }, [user, navigation]);

  // Load frequent foods from local storage
  useEffect(() => {
    const viewed = getFrequentItems('viewed', 8).map(x => x.data);
    const recommended = getFrequentItems('recommended', 8).map(x => x.data);
    const merged = [];
    const seen = new Set();
    [...viewed, ...recommended].forEach(f => {
      if (f && f.name) {
        const id = f.id || f.foodId;
        if (id && !seen.has(id)) {
          seen.add(id);
          merged.push({ ...f, id });
        }
      }
    });
    setFrequentFoods(merged.slice(0, 8));
  }, [user]);

  // 1. Fetch active deficiencies
  useEffect(() => {
    if (isFirebaseConfigured) {
      const targetUid = user?.uid || user?.id || auth?.currentUser?.uid;
      if (!targetUid) return;
      const path = `users/${targetUid}/deficiencies`;
      const q = query(collection(db, path), where('resolved', '==', false));
      const unsubscribe = onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        setDeficiencies(list);
      });
      return () => unsubscribe();
    } else {
      // Mock deficiency warning
      setDeficiencies([
        { id: 'mock-def-1', nutrient: 'iron', averageIntake: 6.2, requiredRda: 18.0, severity: 'CRITICAL', resolved: false }
      ]);
    }
  }, [user?.uid, user?.id]);

  // 2. Fetch mood-based foods on mood change
  useEffect(() => {
    if (activeMood) {
      setMoodLoading(true);
      apiGetMoodRecommendations(activeMood)
        .then(res => {
          setMoodFoods(res.foods || []);
        })
        .catch(err => console.error('Failed to load mood foods', err))
        .finally(() => setMoodLoading(false));
    } else {
      setMoodFoods([]);
    }
  }, [activeMood]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const name     = user?.name || 'there';
  const filtered = filterByCategory(foods, activeCategory);

  // Partition sections
  const recommendedFoods = filtered.slice(0, 12);

  // Centralized recommendation impression tracking (deduplicated by analyticsEventService)
  useEffect(() => {
    if (!loading && Array.isArray(recommendedFoods) && recommendedFoods.length > 0) {
      recommendedFoods.forEach((food, idx) => {
        trackRecommendationImpression(food, {
          position: idx,
          recommendationStrategy: food.recommendationStrategy || (activeMood ? 'mood_aware' : 'context_aware'),
          experimentId: food.experimentId,
          variantId: food.variantId
        });
      });
    }
  }, [loading, recommendedFoods.length, activeMood]);

  const proteinPicks = [...foods]
    .filter(f => f.protein >= 8)
    .sort((a, b) => b.protein - a.protein)
    .slice(0, 8);

  return (
    <AppLayout>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerProfile}>
            <Image 
              source={require('../assets/logo.jpg')}
              style={styles.logo}
            />
            <View>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.profileName}>{name} 👋</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {!loading && (
              <TouchableOpacity onPress={() => { reloadWeather(); reload(); }} style={styles.circleAction}>
                <RefreshCw size={15} color="#ccc" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => setShowNotifications(true)} 
              style={styles.circleAction}
            >
              <Bell size={16} color="#ccc" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Deficiency Alerts */}
        {deficiencies.length > 0 && deficiencies.map(def => (
          <View key={def.id} style={styles.deficiencyCard}>
            <AlertCircle size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deficiencyTitle}>{def.nutrient} Deficiency Flagged</Text>
              <Text style={styles.deficiencyText}>
                Your 14-day average intake is below 65% of your RDA. Add high-density booster foods to your log.
              </Text>
            </View>
          </View>
        ))}

        {/* Weather Status Widget */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherIconContainer}>
            {weather?.rain > 0 ? <CloudRain size={18} color={C.orange} /> : <Thermometer size={18} color={C.orange} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.weatherTitle}>
              {weatherLoading ? 'Checking weather...' : weather ? `Season: ${weather.season}` : 'Weather unavailable'}
            </Text>
            <Text style={styles.weatherSubtitle} numberOfLines={1}>
              {weather ? describeWeatherContext(weather) : weatherError || 'Using your diet profile only'}
            </Text>
          </View>
          {weather?.location && (
            <View style={styles.weatherLocation}>
              <MapPin size={12} color="#666" />
              <Text style={styles.weatherLocationText}>
                {weather.location.source === 'browser' ? 'You' : 'Avadi'}
              </Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Search')} 
            style={styles.searchBar}
          >
            <Search size={16} color="#666" />
            <Text style={styles.searchPlaceholder}>Search foods, nutrients...</Text>
            <SlidersHorizontal size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Compare')} 
            style={[styles.quickLinkButton, styles.quickLinkButtonActive]}
            activeOpacity={0.8}
          >
            <Scale size={14} color={C.orange} style={{ marginRight: 6 }} />
            <Text style={[styles.quickLinkText, { color: '#fff' }]}>Compare Foods</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Analytics')} style={styles.quickLinkButton} activeOpacity={0.8}>
            <Text style={styles.quickLinkText}>📈 Nutrition Charts</Text>
          </TouchableOpacity>
        </View>


        {/* Profile/Preference Settings Banner */}
        <View style={styles.preferencesBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.preferencesTitle}>Your Profile</Text>
            <Text style={styles.preferencesDesc} numberOfLines={1}>
              {preferences.dietType} · {preferences.healthGoals.map(g => g.replace(/_/g,' ')).join(', ')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Preferences')} style={styles.preferencesEditButton}>
            <Text style={styles.preferencesEditText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Fallback Warning */}
        {foods.length > 0 && foods.some(f => f.source === 'fallback') && (
          <View style={styles.fallbackWarning}>
            <AlertCircle size={18} color="#F59E0B" style={{ marginRight: 10 }} />
            <Text style={styles.fallbackWarningText}>Showing personalized FoodieBite recommendations.</Text>
          </View>
        )}

        {/* Recommend by Mood */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="Recommend by Mood 🧠" />
          <MoodSelector activeMood={activeMood} onChange={(m) => setActiveMood(activeMood === m ? null : m)} />
        </View>

        {/* Categories */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="Browse by Type" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {DIET_CATEGORIES.map(cat => {
              const isSelected = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.8}
                  onPress={() => setActiveCategory(cat.id)}
                  style={[
                    styles.categoryButton,
                    isSelected ? { backgroundColor: C.orange, borderColor: C.orange } : { backgroundColor: '#1e1e1e', borderColor: C.border }
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                  <Text style={[styles.categoryText, isSelected ? { color: '#fff' } : { color: '#888' }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Foods content nested list */}
        <View style={{ paddingBottom: 20 }}>
          {/* Frequent Choices */}
          {frequentFoods.length > 0 && !activeMood && (
            <View style={styles.sectionContainer}>
              <SectionHeader title="Your Frequent Choices 🔄" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                {frequentFoods.map(food => <FoodCardH key={food.id} food={food} />)}
              </ScrollView>
            </View>
          )}

          {/* Recommended Foods */}
          <View style={styles.sectionContainer}>
            <SectionHeader
              title={activeMood ? `Mood Booster: ${activeMood}` : `Recommended for You ${!loading && foods.length > 0 ? `(${recommendedFoods.length})` : ''}`}
              onViewAll={activeMood ? null : () => navigation.navigate('RecommendationsAll', { type: 'general' })}
            />

            {activeMood ? (
              moodLoading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                  {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
                </ScrollView>
              ) : moodFoods.length === 0 ? (
                <View style={styles.noFoods}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={{ fontSize: 13, color: '#555' }}>No mood booster foods found</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                  {moodFoods.map(food => <FoodCardH key={food.id} food={food} />)}
                </ScrollView>
              )
            ) : (
              error ? (
                <ErrorState message={error} onRetry={reload} />
              ) : loading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                  {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
                </ScrollView>
              ) : recommendedFoods.length === 0 ? (
                <View style={styles.noFoods}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={{ fontSize: 13, color: '#555' }}>No foods found for this filter</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                  {recommendedFoods.map(food => <FoodCardH key={food.id} food={food} />)}
                </ScrollView>
              )
            )}
          </View>

          {/* High Protein Picks */}
          {!loading && proteinPicks.length > 0 && (
            <View style={styles.sectionContainer}>
              <SectionHeader title="High Protein Picks 💪" onViewAll={() => navigation.navigate('RecommendationsAll', { type: 'protein' })} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodRowScroll}>
                {proteinPicks.map(food => <FoodCardH key={food.id} food={food} />)}
              </ScrollView>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Notifications Modal overlay panel */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.modalTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead} style={styles.markReadButton}>
                    <Check size={14} color={C.orange} style={{ marginRight: 4 }} />
                    <Text style={styles.markReadText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeModalButton}>
                  <X size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotifications}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
                  <Text style={styles.emptyNotificationsTitle}>You're all caught up!</Text>
                  <Text style={styles.emptyNotificationsDesc}>Check back later for personalized recommendations.</Text>
                </View>
              ) : (
                notifications.map(n => {
                  let IconComponent = Bell;
                  let iconBg = 'rgba(255, 255, 255, 0.05)';
                  let iconColor = C.muted;

                  if (n.type === 'welcome') {
                    IconComponent = Sparkles;
                    iconBg = 'rgba(255,107,53,0.12)';
                    iconColor = C.orange;
                  } else if (n.type === 'weather') {
                    IconComponent = CloudRain;
                    iconBg = 'rgba(59, 130, 246, 0.15)';
                    iconColor = '#3b82f6';
                  } else if (n.type === 'goal') {
                    IconComponent = AlertCircle;
                    iconBg = 'rgba(16, 185, 129, 0.15)';
                    iconColor = '#10b981';
                  }

                  return (
                    <View 
                      key={n.id} 
                      style={[
                        styles.notificationItem,
                        n.read ? styles.notificationRead : styles.notificationUnread
                      ]}
                    >
                      {!n.read && <View style={styles.notificationDot} />}
                      <View style={[styles.notificationIconContainer, { backgroundColor: iconBg }]}>
                        <IconComponent size={18} color={iconColor} />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.notificationItemTitle}>{n.title}</Text>
                        <Text style={styles.notificationItemMsg}>{n.message}</Text>
                        <Text style={styles.notificationItemTime}>{n.time}</Text>
                      </View>
                      <TouchableOpacity onPress={() => clearNotification(n.id)} style={styles.deleteNotification}>
                        <Trash2 size={14} color="#555" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
          <TouchableOpacity style={{ flex: 0.3 }} onPress={() => setShowNotifications(false)} />
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.orange,
  },
  greeting: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  circleAction: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: C.orange,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#111318',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  deficiencyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deficiencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'capitalize',
  },
  deficiencyText: {
    fontSize: 11,
    color: '#ffb3b3',
    marginTop: 2,
    lineHeight: 15,
  },
  weatherCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weatherIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  weatherSubtitle: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  weatherLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherLocationText: {
    color: '#666',
    fontSize: 11,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  quickLinks: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  quickLinkButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkButtonActive: {
    borderColor: 'rgba(255, 107, 53, 0.45)',
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    flexDirection: 'row',
  },
  quickLinkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  compareBannerCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1b1b1b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.35)',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  compareBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  compareIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  compareBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 0.5,
  },
  compareBannerSub: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
    lineHeight: 16,
  },
  comparePillHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  comparePillsScroll: {
    gap: 8,
    paddingBottom: 12,
  },
  comparePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  comparePillText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  compareLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  compareLaunchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  preferencesBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,107,53,0.08)', // Simulated gradient
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferencesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },
  preferencesDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    paddingRight: 8,
  },
  preferencesEditButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  preferencesEditText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  fallbackWarning: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fallbackWarningText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  categoryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  foodRowScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  noFoods: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 21, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    flex: 0.7,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  modalBadge: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  modalBadgeText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadText: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#20242c',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyNotificationsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  emptyNotificationsDesc: {
    fontSize: 12,
    color: C.muted2,
    textAlign: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    borderWidth: 1,
    alignItems: 'center',
  },
  notificationRead: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: C.border,
  },
  notificationUnread: {
    backgroundColor: 'rgba(255,107,53,0.04)',
    borderColor: 'rgba(255,107,53,0.15)',
  },
  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
  },
  notificationIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  notificationItemMsg: {
    fontSize: 11,
    color: '#888',
    lineHeight: 15,
    marginBottom: 6,
  },
  notificationItemTime: {
    fontSize: 10,
    color: C.muted2,
  },
  deleteNotification: {
    padding: 4,
  },
});
