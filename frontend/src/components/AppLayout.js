// ─────────────────────────────────────────────────────────────
//  frontend/src/components/AppLayout.js
//  Central Layout Wrapper with Floating Nearby Food Discovery Panel
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  MapPin,
  Search as SearchIcon,
  Filter,
  X,
  Navigation,
  Phone,
  Globe,
  Clock,
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Camera
} from 'lucide-react-native';
import BottomNav from './BottomNav';
import { useApp } from '../context/AppContext';
import { getCurrentPosition } from '../services/geolocation';
import { apiGetNearbyRestaurants, apiGeocodeAddress } from '../services/api';

const C = {
  orange: '#FF6B35',
  card: '#1e1e1e',
  border: 'rgba(255,255,255,0.08)',
  muted: '#7f8794',
  text: '#ffffff',
  textSecondary: '#a0a7b5',
  bg: '#111318',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',
  dangerText: '#ef4444'
};

const CUISINES = ['All', 'Indian', 'Chinese', 'Italian', 'Bakery', 'Fast Food'];
const RADII = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 }
];

export default function AppLayout({ children, noPadding, footer, hideNearby = false }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { preferences = {}, nearbyTrigger, setNearbyTrigger } = useApp();

  // Panel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

  // Search parameters
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [selectedDiet, setSelectedDiet] = useState('all'); // all, vegetarian, vegan
  const [selectedRadius, setSelectedRadius] = useState(5000);
  const [selectedBudget, setSelectedBudget] = useState('All'); // All, ₹, ₹₹, ₹₹₹
  const [openNowFilter, setOpenNowFilter] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Listen for AI chat triggered searches
  useEffect(() => {
    if (nearbyTrigger) {
      setPanelOpen(true);
      
      if (nearbyTrigger.query) {
        setSearchQuery(nearbyTrigger.query);
      }
      if (nearbyTrigger.cuisine) {
        const capitalizedCuisine = nearbyTrigger.cuisine.charAt(0).toUpperCase() + nearbyTrigger.cuisine.slice(1);
        if (CUISINES.includes(capitalizedCuisine)) {
          setSelectedCuisine(capitalizedCuisine);
        } else {
          setSelectedCuisine('All');
        }
      }
      if (nearbyTrigger.radius) {
        setSelectedRadius(nearbyTrigger.radius);
      }
      if (nearbyTrigger.budget) {
        setSelectedBudget(nearbyTrigger.budget);
      }
      if (nearbyTrigger.openNow !== undefined) {
        setOpenNowFilter(nearbyTrigger.openNow);
      }
      if (nearbyTrigger.dietaryPreferences && nearbyTrigger.dietaryPreferences.length > 0) {
        const dietVal = nearbyTrigger.dietaryPreferences[0].toLowerCase();
        if (dietVal === 'vegetarian' || dietVal === 'vegan') {
          setSelectedDiet(dietVal);
        }
      }

      setNearbyTrigger(null);

      if (!userLocation) {
        acquireLocation();
      }
    }
  }, [nearbyTrigger]);

  // Trigger search whenever location or filters change
  useEffect(() => {
    if (panelOpen && userLocation) {
      fetchNearby();
    }
  }, [userLocation, selectedCuisine, selectedDiet, selectedRadius, selectedBudget, openNowFilter]);

  const acquireLocation = () => {
    setLoading(true);
    setError(null);
    setShowAddressForm(false);

    getCurrentPosition(
      (position) => {
        const coords = position.coords || {};
        setUserLocation({
          lat: coords.latitude,
          lng: coords.longitude
        });
        setLocationName(`GPS: ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
        setLoading(false);
      },
      (err) => {
        console.warn('Geolocation failed:', err.message);
        setLoading(false);
        // Prompt for address search
        setShowAddressForm(true);
        setError('Location permission denied or unavailable. Enter an address below.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleAddressSearch = async () => {
    if (!addressInput.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiGeocodeAddress(addressInput.trim());
      if (data && data.success) {
        setUserLocation({
          lat: data.lat,
          lng: data.lng
        });
        setLocationName(data.address || addressInput);
        setShowAddressForm(false);
      } else {
        setError('Could not find that address. Please try another area.');
      }
    } catch (err) {
      setError(err.message || 'Geocoding service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearby = async () => {
    if (!userLocation) return;
    setLoading(true);
    setError(null);

    try {
      const params = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius: selectedRadius,
        query: searchQuery.trim() || undefined,
        cuisine: selectedCuisine !== 'All' ? selectedCuisine : undefined,
        diet: selectedDiet !== 'all' ? selectedDiet : undefined,
        budget: selectedBudget !== 'All' ? selectedBudget : undefined,
        exclusions: preferences.exclusions || undefined
      };

      const res = await apiGetNearbyRestaurants(params);
      if (res && res.success) {
        let finalResults = res.results || [];
        if (openNowFilter) {
          finalResults = finalResults.filter(p => p.isOpen === true);
        }
        setResults(finalResults);
      } else {
        setError(res.error || 'Failed to search nearby restaurants.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch restaurants.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWebsite = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => console.warn('Failed to open link:', err));
    }
  };

  const handleCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(err => console.warn('Failed to make call:', err));
    }
  };

  const { width: screenWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobileView = screenWidth < 640;

  return (
    <View style={styles.phoneFrame}>
      <View style={[styles.main, { paddingTop: insets.top, paddingBottom: noPadding ? 0 : 12 }]}>
        {children}
      </View>
      {footer !== undefined ? footer : <BottomNav />}

      {/* Floating Action Buttons */}
      {!hideNearby && !panelOpen && (
        <>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('NutritionScanner');
              }
            }}
            style={styles.floatingScannerButton}
            accessibilityRole="button"
            accessibilityLabel="Scan Food Nutrition"
          >
            <Camera size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setPanelOpen(true);
              if (!userLocation) {
                acquireLocation();
              }
            }}
            style={styles.floatingButton}
          >
            <MapPin size={24} color="#fff" />
            {isWeb && <Text style={styles.floatingButtonText}>Nearby</Text>}
          </TouchableOpacity>
        </>
      )}

      {/* Discovery Drawer / Overlay panel */}
      {panelOpen && (
        <View style={[styles.overlayContainer, (isWeb && !isMobileView) ? styles.webOverlay : styles.mobileOverlay]}>
          
          {/* Header */}
          <View style={styles.panelHeader}>
            <View style={styles.headerTitleContainer}>
              <MapPin size={20} color={C.orange} style={{ marginRight: 6 }} />
              <Text style={styles.panelTitle}>Nearby Food Discovery</Text>
            </View>
            <TouchableOpacity onPress={() => setPanelOpen(false)} style={styles.closeButton}>
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Location Area */}
          <View style={styles.locationContainer}>
            {locationName ? (
              <View style={styles.locationActiveRow}>
                <Navigation size={13} color={C.orange} style={{ marginRight: 6 }} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationName}
                </Text>
                <TouchableOpacity onPress={acquireLocation} style={styles.reAcquireBtn}>
                  <Text style={styles.reAcquireText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddressForm(!showAddressForm)} style={styles.reAcquireBtn}>
                  <Text style={styles.reAcquireText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={acquireLocation} style={styles.useLocationBtn}>
                <Navigation size={14} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.useLocationText}>Use My Location</Text>
              </TouchableOpacity>
            )}

            {/* Geocode Manual Address Entry Fallback */}
            {showAddressForm && (
              <View style={styles.addressForm}>
                <TextInput
                  style={styles.addressInput}
                  placeholder="Enter area (e.g., Avadi, Chennai)"
                  placeholderTextColor={C.muted}
                  value={addressInput}
                  onChangeText={setAddressInput}
                  onSubmitEditing={handleAddressSearch}
                />
                <TouchableOpacity onPress={handleAddressSearch} style={styles.addressSubmitBtn}>
                  <Text style={styles.addressSubmitText}>Search</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Filters & Inputs */}
          <View style={styles.filtersSection}>
            
            {/* Keyword Search */}
            <View style={styles.searchBarContainer}>
              <SearchIcon size={14} color={C.muted} style={{ marginLeft: 10, marginRight: 6 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search restaurant or cuisine..."
                placeholderTextColor={C.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={fetchNearby}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setTimeout(fetchNearby, 0); }} style={{ padding: 6 }}>
                  <X size={14} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Radius & Diet Filter row */}
            <View style={styles.filterRow}>
              {/* Diet Type */}
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  onPress={() => setSelectedDiet('all')}
                  style={[styles.toggleBtn, selectedDiet === 'all' && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, selectedDiet === 'all' && styles.toggleTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedDiet('vegetarian')}
                  style={[styles.toggleBtn, selectedDiet === 'vegetarian' && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, selectedDiet === 'vegetarian' && styles.toggleTextActive]}>Veg</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedDiet('vegan')}
                  style={[styles.toggleBtn, selectedDiet === 'vegan' && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, selectedDiet === 'vegan' && styles.toggleTextActive]}>Vegan</Text>
                </TouchableOpacity>
              </View>

              {/* Radius Select */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusScroll}>
                {RADII.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setSelectedRadius(r.value)}
                    style={[styles.radiusBtn, selectedRadius === r.value && styles.radiusBtnActive]}
                  >
                    <Text style={[styles.radiusText, selectedRadius === r.value && styles.radiusTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Budget & Open Now Filter row */}
            <View style={styles.filterRow}>
              {/* Budget selector */}
              <View style={styles.toggleGroup}>
                {['All', '₹', '₹₹', '₹₹₹'].map(b => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setSelectedBudget(b)}
                    style={[styles.toggleBtn, selectedBudget === b && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleText, selectedBudget === b && styles.toggleTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Open Now switch */}
              <TouchableOpacity
                onPress={() => setOpenNowFilter(!openNowFilter)}
                style={[styles.openNowBtn, openNowFilter && styles.openNowBtnActive]}
              >
                <Clock size={12} color={openNowFilter ? '#fff' : C.muted} style={{ marginRight: 4 }} />
                <Text style={[styles.openNowText, openNowFilter && styles.openNowTextActive]}>Open Now</Text>
              </TouchableOpacity>
            </View>

            {/* Cuisines Scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineScroll}>
              {CUISINES.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedCuisine(c)}
                  style={[styles.cuisineBtn, selectedCuisine === c && styles.cuisineBtnActive]}
                >
                  <Text style={[styles.cuisineText, selectedCuisine === c && styles.cuisineTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </View>

          {/* Results List */}
          <View style={{ flex: 1 }}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={C.orange} />
                <Text style={styles.loadingText}>Searching nearby restaurants...</Text>
              </View>
            )}

            {!loading && error && (
              <View style={styles.errorContainer}>
                <AlertTriangle size={24} color={C.dangerText} style={{ marginBottom: 8 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && results.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🍽️</Text>
                <Text style={styles.emptyText}>No restaurants found in this area.</Text>
                <Text style={styles.emptySubText}>Try increasing the radius or clearing filters.</Text>
              </View>
            )}

            {!loading && !error && results.length > 0 && (
              <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
                {results.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const hasAllergies = preferences.allergies && preferences.allergies.length > 0;
                  
                  return (
                    <View key={item.id} style={styles.restaurantCard}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setExpandedId(isExpanded ? null : item.id)}
                        style={styles.cardHeader}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.restaurantName}>{item.name}</Text>
                          <View style={styles.metaRow}>
                            {item.rating && (
                              <View style={styles.ratingBadge}>
                                <Star size={10} color="#FFD700" style={{ marginRight: 2 }} />
                                <Text style={styles.ratingText}>{item.rating}</Text>
                              </View>
                            )}
                            <Text style={styles.metaText}>{item.distance} km</Text>
                            {item.cuisine && (
                              <Text style={styles.metaText} numberOfLines={1}>
                                · {item.cuisine.split(';').join(', ')}
                              </Text>
                            )}
                          </View>
                        </View>
                        {isExpanded ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                      </TouchableOpacity>

                      {/* Match Justification */}
                      {item.explanation && (
                        <View style={styles.justificationCard}>
                          <Sparkles size={12} color={C.orange} style={{ marginRight: 6 }} />
                          <Text style={styles.justificationText}>{item.explanation}</Text>
                        </View>
                      )}

                      {/* Allergy Warnings */}
                      {item.safetyNotes && item.safetyNotes.length > 0 && (
                        <View style={styles.allergyWarningCard}>
                          <AlertTriangle size={12} color={C.dangerText} style={{ marginRight: 6 }} />
                          <View style={{ flex: 1 }}>
                            {item.safetyNotes.map((note, noteIdx) => (
                              <Text key={noteIdx} style={styles.allergyWarningText}>
                                {note}
                              </Text>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Expandable Details */}
                      {isExpanded && (
                        <View style={styles.cardDetails}>
                          {item.address && (
                            <View style={styles.detailItem}>
                              <MapPin size={12} color={C.muted} style={styles.detailIcon} />
                              <Text style={styles.detailText}>{item.address}</Text>
                            </View>
                          )}
                          {item.openingHours && (
                            <View style={styles.detailItem}>
                              <Clock size={12} color={C.muted} style={styles.detailIcon} />
                              <Text style={styles.detailText}>{item.openingHours}</Text>
                            </View>
                          )}

                          <View style={styles.actionRow}>
                            {item.phone && (
                              <TouchableOpacity onPress={() => handleCall(item.phone)} style={styles.actionBtn}>
                                <Phone size={12} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnText}>Call</Text>
                              </TouchableOpacity>
                            )}
                            {item.website && (
                              <TouchableOpacity onPress={() => handleOpenWebsite(item.website)} style={styles.actionBtn}>
                                <Globe size={12} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnText}>Website</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              onPress={() => handleOpenWebsite(item.sourceUrl || `https://www.openstreetmap.org/search?query=${encodeURIComponent(item.name)}`)}
                              style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border }]}
                            >
                              <Text style={[styles.actionBtnText, { color: C.muted }]}>Map</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  phoneFrame: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: C.bg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    width: '100%'
  },
  main: {
    flex: 1,
    overflow: 'hidden'
  },
  floatingScannerButton: {
    position: 'absolute',
    bottom: 134,
    right: 16,
    backgroundColor: C.orange,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  },
  floatingButton: {
    position: 'absolute',
    bottom: 74,
    right: 16,
    backgroundColor: C.orange,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  },
  floatingButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
    fontSize: 12,
    marginRight: 6
  },
  overlayContainer: {
    backgroundColor: '#161920',
    borderTopWidth: 1,
    borderColor: C.border,
    zIndex: 10000,
    flexDirection: 'column'
  },
  webOverlay: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 380,
    maxWidth: '90%',
    height: 520,
    maxHeight: '80%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10
  },
  mobileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  panelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 6,
    borderRadius: 14
  },
  locationContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1b1e27',
    borderBottomWidth: 1,
    borderBottomColor: C.border
  },
  useLocationBtn: {
    backgroundColor: C.orange,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  useLocationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  locationActiveRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    color: C.textSecondary,
    fontSize: 11,
    flex: 1
  },
  reAcquireBtn: {
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6
  },
  reAcquireText: {
    color: C.orange,
    fontSize: 10,
    fontWeight: '700'
  },
  addressForm: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8
  },
  addressInput: {
    flex: 1,
    backgroundColor: '#12141a',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 11
  },
  addressSubmitBtn: {
    backgroundColor: C.orange,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6
  },
  addressSubmitText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 10,
    color: '#fff',
    fontSize: 12
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#12141a',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  toggleBtnActive: {
    backgroundColor: C.orange
  },
  toggleText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700'
  },
  toggleTextActive: {
    color: '#fff'
  },
  radiusScroll: {
    gap: 6
  },
  radiusBtn: {
    backgroundColor: '#12141a',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  radiusBtnActive: {
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderColor: C.orange
  },
  radiusText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  radiusTextActive: {
    color: C.orange
  },
  cuisineScroll: {
    gap: 8
  },
  cuisineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#12141a',
    borderWidth: 1,
    borderColor: C.border
  },
  cuisineBtnActive: {
    backgroundColor: C.orange,
    borderColor: C.orange
  },
  cuisineText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700'
  },
  cuisineTextActive: {
    color: '#fff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  loadingText: {
    color: C.muted,
    fontSize: 11,
    marginTop: 8
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorText: {
    color: C.dangerText,
    fontSize: 11,
    textAlign: 'center'
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  emptySubText: {
    color: C.muted,
    fontSize: 11
  },
  resultsScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  restaurantCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
    overflow: 'hidden'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12
  },
  restaurantName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800'
  },
  metaText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  allergyWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dangerBg,
    borderColor: C.dangerBorder,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  allergyWarningText: {
    color: C.dangerText,
    fontSize: 9,
    fontWeight: '600',
    flex: 1
  },
  cardDetails: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: '#1a1c22',
    gap: 8
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  detailIcon: {
    marginTop: 2,
    marginRight: 6
  },
  detailText: {
    color: C.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    flex: 1
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    backgroundColor: C.orange,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700'
  },
  justificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,107,53,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  justificationText: {
    color: '#FF8C61',
    fontSize: 10,
    fontWeight: '600',
    flex: 1
  },
  openNowBtn: {
    backgroundColor: '#12141a',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  openNowBtnActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#4caf50'
  },
  openNowText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700'
  },
  openNowTextActive: {
    color: '#fff'
  }
});
