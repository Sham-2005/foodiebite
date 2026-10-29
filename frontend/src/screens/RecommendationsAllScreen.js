import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Sparkles, Flame, ShieldCheck } from 'lucide-react-native';
import AppLayout from '../components/AppLayout';
import { FoodCardRow, C } from '../components/UI';
import { useRecommendations } from '../hooks/useFoods';
import { useApp } from '../context/AppContext';

export default function RecommendationsAllScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const type = route.params?.type || 'general'; // 'general' or 'protein'
  
  const { preferences } = useApp();
  const { foods, loading } = useRecommendations(preferences, 40);
  const [visibleCount, setVisibleCount] = React.useState(10);

  // Partition the lists to match HomeScreen logic
  const recommendedFoods = foods;
  const proteinPicks = [...foods]
    .filter(f => f.protein >= 8)
    .sort((a, b) => b.protein - a.protein);

  const displayedFoods = type === 'protein' ? proteinPicks : recommendedFoods;
  const title = type === 'protein' ? 'High Protein Picks' : 'Personalized For You';
  const subtitle = type === 'protein' 
    ? 'High-density protein selections optimized for muscle growth and recovery.' 
    : 'Balanced foods tailored specifically to your diet, goals, and season.';
  const Icon = type === 'protein' ? Flame : Sparkles;

  return (
    <AppLayout>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
        {/* Intro Banner */}
        <View style={styles.introBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon size={16} color={C.orange} />
            <Text style={styles.bannerBadge}>
              {type === 'protein' ? 'Muscle Fuel' : 'AI Recommendation'}
            </Text>
          </View>
          <Text style={styles.bannerText}>
            {subtitle}
          </Text>
        </View>

        {/* Results List */}
        <View>
          {loading && displayedFoods.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>Loading curated selections...</Text>
            </View>
          ) : displayedFoods.length === 0 ? (
            <View style={styles.emptyBox}>
              <ShieldCheck size={40} color={C.muted2} style={{ marginBottom: 12, opacity: 0.5 }} />
              <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>No matching foods currently found</Text>
              <Text style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Try adjusting your diet preferences</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'column' }}>
              <Text style={styles.resultsCount}>
                Showing {Math.min(visibleCount, displayedFoods.length)} of {displayedFoods.length} premium products
              </Text>
              {displayedFoods.slice(0, visibleCount).map(food => (
                <FoodCardRow key={food.id} food={food} />
              ))}

              {/* Load More Button */}
              {displayedFoods.length > visibleCount && (
                <TouchableOpacity
                  onPress={() => setVisibleCount(prev => prev + 10)}
                  style={styles.loadMoreBtn}
                >
                  <Text style={styles.loadMoreBtnText}>Load More Products</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  backBtn: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  introBanner: {
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.15)',
    marginBottom: 20,
  },
  bannerBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bannerText: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: 12,
    color: C.muted2,
    marginBottom: 12,
    fontWeight: '600',
  },
  loadMoreBtn: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtnText: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '700',
  },
});
