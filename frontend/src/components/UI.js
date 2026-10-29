import React from 'react';
import { View, Text, TouchableOpacity, TextInput as RNTextInput, Image, ScrollView, StyleSheet } from 'react-native';
import { Heart, Flame } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { gradeColor, gradeLabel } from '../services/openFoodFacts';
import { resolveFoodImage, getCuratedFallbackImage, resolveFoodGrade } from '../services/foodHelpers';
import { trackRecommendationClick, trackFoodAddedToFavorites, trackFoodRemovedFromFavorites } from '../services/analyticsEventService';

export const C = {
  bg: '#111318', card: '#171a20', card2: '#20242c',
  border: 'rgba(255,255,255,0.08)', orange: '#FF6B35', text: '#ffffff',
  muted: '#a0a7b4', muted2: '#6f7785', input: '#171a20', inputB: 'rgba(255,255,255,0.1)',
};

export function BtnOrange({ children, onClick, style, disabled, outline }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onClick}
      style={[
        styles.btnOrange,
        outline ? styles.btnOrangeOutline : styles.btnOrangeFilled,
        disabled && { opacity: 0.5 },
        style
      ]}
    >
      <Text style={[styles.btnOrangeText, outline && { color: C.orange }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

export function TextInput({ icon: Icon, placeholder, value, onChangeText, onChange, secureTextEntry, rightIcon, keyboardType }) {
  // Backwards compat check: original code might pass onChange (event-based) or we can support onChangeText
  const handleTextChange = (text) => {
    if (onChangeText) {
      onChangeText(text);
    } else if (onChange) {
      onChange({ target: { value: text } });
    }
  };

  return (
    <View style={styles.textInputContainer}>
      {Icon && <Icon size={18} color={C.muted} />}
      <RNTextInput
        placeholder={placeholder}
        placeholderTextColor={C.muted2}
        value={value}
        onChangeText={handleTextChange}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.textInput}
      />
      {rightIcon}
    </View>
  );
}

export function GradeBadge({ grade, food, style }) {
  const resolved = resolveFoodGrade(grade || food);
  const color = gradeColor(resolved);
  return (
    <View style={[styles.gradeBadge, { backgroundColor: color }, style]}>
      <Text style={styles.gradeBadgeText}>{resolved}</Text>
    </View>
  );
}

export function TagPill({ label, style }) {
  return (
    <View style={[styles.tagPill, style]}>
      <Text style={styles.tagPillText}>{label}</Text>
    </View>
  );
}

export function FoodImageFallback({ name, height = 100, width = '100%' }) {
  const colors = ['#2a1f1a', '#1a2a1f', '#1a1a2a', '#2a2a1a'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const emojis = ['🥗', '🍲', '🥙', '🫙', '🥘', '🍱'];
  const emoji = emojis[(name?.charCodeAt(0) || 0) % emojis.length];

  return (
    <View style={[styles.fallbackContainer, { width, height, backgroundColor: bg }]}>
      <Text style={{ fontSize: typeof height === 'number' ? height * 0.28 : 28 }}>{emoji}</Text>
      <Text style={styles.fallbackText} numberOfLines={1}>
        {name?.slice(0, 18)}
      </Text>
    </View>
  );
}

function FoodCardHBase({ food, style }) {
  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject } = useApp();
  const isFav = favorites.foods.includes(food?.id);
  const navigation = useNavigation();

  const initialImg = resolveFoodImage(food);
  const [currentImg, setCurrentImg] = React.useState(initialImg);
  const [triedFallback, setTriedFallback] = React.useState(false);
  const [hasFailed, setHasFailed] = React.useState(!initialImg);

  React.useEffect(() => {
    const resolved = resolveFoodImage(food);
    setCurrentImg(resolved);
    setTriedFallback(false);
    setHasFailed(!resolved);
  }, [food?.id, food?.foodId, food?.image, food?.imageUrl, food?.image_url]);

  const handleImageError = () => {
    if (!triedFallback) {
      const fallbackUrl = getCuratedFallbackImage(food);
      if (fallbackUrl && fallbackUrl !== currentImg) {
        setTriedFallback(true);
        setCurrentImg(fallbackUrl);
        return;
      }
    }
    setHasFailed(true);
  };

  function handleFav() {
    if (isFav) {
      removeSavedFoodObject(food?.id);
      trackFoodRemovedFromFavorites(food?.id);
    } else {
      saveFoodObject(food);
      trackFoodAddedToFavorites(food);
    }
    toggleFavoriteFood(food?.id, food);
  }

  const grade = resolveFoodGrade(food);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        trackRecommendationClick(food);
        navigation.navigate('FoodDetail', { id: food.id, food });
      }}
      style={[styles.foodCardH, style]}
    >
      <View style={styles.foodCardHMedia}>
        {currentImg && !hasFailed ? (
          <Image
            source={{ uri: currentImg }}
            onError={handleImageError}
            style={styles.imageFull}
            resizeMode="cover"
          />
        ) : (
          <FoodImageFallback name={food?.name} height="100%" />
        )}
        <TouchableOpacity onPress={handleFav} style={styles.heartButton}>
          <Heart size={13} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#fff'} />
        </TouchableOpacity>
        <GradeBadge grade={grade} style={styles.gradeBadgeH} />
      </View>
      <View style={{ padding: 10 }}>
        <Text style={styles.foodCardHTitle} numberOfLines={2}>
          {food?.name}
        </Text>
        <View style={styles.foodCardHStats}>
          <Flame size={10} color={C.orange} style={{ marginRight: 2 }} />
          <Text style={styles.foodCardHStatsText}>
            {food?.calories} kcal · {food?.protein}g protein
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const FoodCardH = React.memo(FoodCardHBase);

function FoodCardRowBase({ food }) {
  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject } = useApp();
  const isFav = favorites.foods.includes(food?.id);
  const navigation = useNavigation();

  const initialImg = resolveFoodImage(food);
  const [currentImg, setCurrentImg] = React.useState(initialImg);
  const [triedFallback, setTriedFallback] = React.useState(false);
  const [hasFailed, setHasFailed] = React.useState(!initialImg);

  React.useEffect(() => {
    const resolved = resolveFoodImage(food);
    setCurrentImg(resolved);
    setTriedFallback(false);
    setHasFailed(!resolved);
  }, [food?.id, food?.foodId, food?.image, food?.imageUrl, food?.image_url]);

  const handleImageError = () => {
    if (!triedFallback) {
      const fallbackUrl = getCuratedFallbackImage(food);
      if (fallbackUrl && fallbackUrl !== currentImg) {
        setTriedFallback(true);
        setCurrentImg(fallbackUrl);
        return;
      }
    }
    setHasFailed(true);
  };

  function handleFav() {
    if (isFav) {
      removeSavedFoodObject(food?.id);
      trackFoodRemovedFromFavorites(food?.id);
    } else {
      saveFoodObject(food);
      trackFoodAddedToFavorites(food);
    }
    toggleFavoriteFood(food?.id, food);
  }

  const grade = resolveFoodGrade(food);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        trackRecommendationClick(food);
        navigation.navigate('FoodDetail', { id: food.id, food });
      }}
      style={styles.foodCardRow}
    >
      <View style={styles.foodRowMedia}>
        {currentImg && !hasFailed ? (
          <Image
            source={{ uri: currentImg }}
            onError={handleImageError}
            style={[styles.imageFull, { borderRadius: 10 }]}
            resizeMode="cover"
          />
        ) : (
          <FoodImageFallback name={food?.name} height={60} width={60} />
        )}
        <GradeBadge grade={grade} style={styles.gradeBadgeRow} />
      </View>
      <View style={styles.foodRowContent}>
        <Text style={styles.foodRowTitle} numberOfLines={1}>
          {food?.name}
        </Text>
        <Text style={styles.foodRowStats}>
          {food?.calories} kcal · {food?.protein}g protein · {food?.carbs}g carbs
        </Text>
        <View style={styles.foodRowPills}>
          {(food?.labels || []).slice(0, 2).map((l, index) => (
            <TagPill key={index} label={l.replace('en:', '').replace(/-/g, ' ')} style={{ marginRight: 4 }} />
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={handleFav} style={{ padding: 4 }}>
        <Heart size={20} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : C.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export const FoodCardRow = React.memo(FoodCardRowBase);

function Shimmer({ style }) {
  return (
    <View style={[styles.shimmer, style]} />
  );
}

export function SkeletonCard({ style }) {
  return (
    <View style={[styles.skeletonCard, style]}>
      <Shimmer style={styles.skeletonCardImage} />
      <View style={{ padding: 10 }}>
        <Shimmer style={styles.skeletonTextLine1} />
        <Shimmer style={styles.skeletonTextLine2} />
      </View>
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <Shimmer style={styles.skeletonRowImage} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Shimmer style={styles.skeletonTextLine1} />
        <Shimmer style={styles.skeletonTextLine2} />
        <Shimmer style={styles.skeletonTextLine3} />
      </View>
    </View>
  );
}

export function MacroChip({ label, value, unit }) {
  return (
    <View style={styles.macroChip}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroUnit}>{unit || 'g'}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, onViewAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.sectionHeaderLink}>View all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.errorState}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
      <Text style={styles.errorStateTitle}>Couldn't load foods</Text>
      <Text style={styles.errorStateText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.errorStateButton}>
          <Text style={styles.errorStateButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function BackHeader({ title, right }) {
  const navigation = useNavigation();
  return (
    <View style={styles.backHeader}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
      {title && <Text style={styles.backHeaderTitle}>{title}</Text>}
      <View>{right || <View style={{ width: 34 }} />}</View>
    </View>
  );
}

export function HealthScoreBadge({ score = 5.0, grade = 'C', style }) {
  let color = '#F59E0B'; // Amber Orange
  if (score >= 9.0) color = '#10B981'; // Emerald Green
  else if (score >= 7.5) color = '#34D399'; // Mint Green
  else if (score >= 6.0) color = '#059669'; // Dark Green
  else if (score >= 3.0) color = '#EF4444'; // Coral Red
  else color = '#B91C1C'; // Deep Crimson

  return (
    <View style={[styles.healthScoreBadge, style]}>
      <View style={[styles.healthScoreDot, { backgroundColor: color }]} />
      <Text style={styles.healthScoreText}>{score.toFixed(1)}</Text>
      <View style={[styles.healthScoreLabelContainer, { backgroundColor: `${color}1A` }]}>
        <Text style={[styles.healthScoreLabel, { color }]}>Grade {grade}</Text>
      </View>
    </View>
  );
}

export function HealthScoreCard({ food, style }) {
  const protein = food.protein || 0;
  const fiber = food.fiber || 0;
  const sugar = food.sugar || 0;
  const sodium = food.sodium || 0;
  const fat = food.fat || 0;
  const satFat = food.saturatedFat || Math.round(fat * 0.3 * 10) / 10;
  
  const labels = food.labels || [];
  let nova = 1;
  if (labels.some(l => l.includes('nova-4') || l.includes('ultra-processed'))) nova = 4;
  else if (labels.some(l => l.includes('nova-3'))) nova = 3;
  else if (labels.some(l => l.includes('nova-2'))) nova = 2;

  const proteinBonus = Math.min(2.0, protein * 0.2);
  const fiberBonus = Math.min(2.0, fiber * 0.4);
  const sugarPenalty = Math.min(2.5, sugar * 0.15);
  const sodiumPenalty = Math.min(1.5, sodium * 0.002);
  const satFatPenalty = Math.min(1.5, satFat * 0.1);
  const novaPenalty = nova === 4 ? 2.5 : (nova === 3 ? 1.0 : (nova === 2 ? 0.5 : 0.0));

  return (
    <View style={[styles.healthScoreCard, style]}>
      <View style={styles.healthScoreCardHeader}>
        <Text style={styles.healthScoreCardTitle}>Nutritional Index Calculator</Text>
        <HealthScoreBadge score={food.healthScore || 5.0} grade={food.healthGrade || 'C'} />
      </View>
      
      <View style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Protein line */}
        <View>
          <View style={styles.healthLineHeader}>
            <Text style={styles.healthLineLabel}>Protein Content ({protein}g)</Text>
            <Text style={[styles.healthLineValue, { color: '#10B981' }]}>+{proteinBonus.toFixed(2)} Bonus</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { backgroundColor: '#10B981', width: `${(proteinBonus / 2.0) * 100}%` }]} />
          </View>
        </View>

        {/* Fiber line */}
        <View>
          <View style={styles.healthLineHeader}>
            <Text style={styles.healthLineLabel}>Dietary Fiber ({fiber}g)</Text>
            <Text style={[styles.healthLineValue, { color: '#10B981' }]}>+{fiberBonus.toFixed(2)} Bonus</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { backgroundColor: '#10B981', width: `${(fiberBonus / 2.0) * 100}%` }]} />
          </View>
        </View>

        {/* Sugar line */}
        <View>
          <View style={styles.healthLineHeader}>
            <Text style={styles.healthLineLabel}>Refined Sugar ({sugar}g)</Text>
            <Text style={[styles.healthLineValue, { color: '#EF4444' }]}>-{sugarPenalty.toFixed(2)} Penalty</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { backgroundColor: '#EF4444', width: `${(sugarPenalty / 2.5) * 100}%` }]} />
          </View>
        </View>

        {/* Sodium line */}
        <View>
          <View style={styles.healthLineHeader}>
            <Text style={styles.healthLineLabel}>Sodium ({sodium}mg)</Text>
            <Text style={[styles.healthLineValue, { color: '#EF4444' }]}>-{sodiumPenalty.toFixed(2)} Penalty</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { backgroundColor: '#EF4444', width: `${(sodiumPenalty / 1.5) * 100}%` }]} />
          </View>
        </View>

        {/* Processing label */}
        <View style={styles.processingRow}>
          <View>
            <Text style={styles.processingTitle}>NOVA Group {nova}</Text>
            <Text style={styles.processingDesc}>
              {nova === 4 ? 'Ultra-processed food product' : (nova === 3 ? 'Processed food' : 'Minimally processed / Natural')}
            </Text>
          </View>
          <Text style={[styles.processingPenalty, { color: nova === 4 ? '#EF4444' : C.muted }]}>
            {novaPenalty > 0 ? `-${novaPenalty.toFixed(1)} Penalty` : 'Clean Rating'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function MoodSelector({ activeMood, onChange, style }) {
  const moods = [
    { name: 'Happy', emoji: '😊', label: 'Happy' },
    { name: 'Stressed', emoji: '🤯', label: 'Stressed' },
    { name: 'Studying', emoji: '🧠', label: 'Study' },
    { name: 'Working', emoji: '💻', label: 'Work' },
    { name: 'Gym', emoji: '🏋️', label: 'Workout' },
    { name: 'Relaxing', emoji: '🍵', label: 'Relax' }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.moodScroll}
    >
      {moods.map(m => {
        const isSelected = activeMood === m.name;
        return (
          <TouchableOpacity
            key={m.name}
            activeOpacity={0.8}
            onPress={() => onChange(m.name)}
            style={[
              styles.moodButton,
              isSelected ? styles.moodButtonSelected : styles.moodButtonUnselected
            ]}
          >
            <Text style={{ fontSize: 13 }}>{m.emoji}</Text>
            <Text style={styles.moodButtonText}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  btnOrange: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOrangeFilled: {
    backgroundColor: C.orange,
  },
  btnOrangeOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.orange,
  },
  btnOrangeText: {
    fontWeight: '700',
    fontSize: 15,
    color: '#fff',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputB,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 4,
  },
  gradeBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeText: {
    fontWeight: '800',
    fontSize: 13,
    color: '#fff',
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  tagPillText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '600',
  },
  fallbackContainer: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 10,
    color: '#6f7785',
    textAlign: 'center',
    paddingHorizontal: 6,
    maxWidth: '90%',
  },
  foodCardH: {
    backgroundColor: C.card,
    borderRadius: 14,
    overflow: 'hidden',
    width: 150,
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  foodCardHMedia: {
    height: 100,
    position: 'relative',
    backgroundColor: '#1e222b',
  },
  imageFull: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeH: {
    position: 'absolute',
    bottom: 7,
    left: 7,
  },
  foodCardHTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    marginBottom: 3,
    lineHeight: 16,
    height: 32, // Allow 2 lines
  },
  foodCardHStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  foodCardHStatsText: {
    fontSize: 11,
    color: C.muted,
  },
  foodCardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  foodRowMedia: {
    width: 60,
    height: 60,
    position: 'relative',
    flexShrink: 0,
  },
  gradeBadgeRow: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  foodRowContent: {
    flex: 1,
    minWidth: 0,
  },
  foodRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  foodRowStats: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 5,
  },
  foodRowPills: {
    flexDirection: 'row',
  },
  shimmer: {
    backgroundColor: '#2a2a2a',
    opacity: 0.6,
  },
  skeletonCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
  },
  skeletonCardImage: {
    aspectRatio: 1.33,
    width: '100%',
  },
  skeletonTextLine1: {
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
    width: '80%',
  },
  skeletonTextLine2: {
    height: 10,
    borderRadius: 6,
    width: '55%',
  },
  skeletonTextLine3: {
    height: 14,
    borderRadius: 10,
    width: '35%',
    marginTop: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  skeletonRowImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    flexShrink: 0,
  },
  macroChip: {
    flex: 1,
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  macroUnit: {
    fontSize: 10,
    color: C.muted,
  },
  macroLabel: {
    fontSize: 10,
    color: C.orange,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeaderLink: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '600',
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorStateTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 16,
  },
  errorStateText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorStateButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: C.orange,
  },
  errorStateButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  healthScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  healthScoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  healthScoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    marginRight: 6,
  },
  healthScoreLabelContainer: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  healthScoreLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  healthScoreCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
  },
  healthScoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthScoreCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  healthLineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  healthLineLabel: {
    fontSize: 11,
    color: C.muted,
  },
  healthLineValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#222',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  processingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  processingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
  },
  processingDesc: {
    fontSize: 10,
    color: C.muted,
  },
  processingPenalty: {
    fontSize: 11,
    fontWeight: '700',
  },
  moodScroll: {
    paddingVertical: 4,
    paddingBottom: 12,
    flexDirection: 'row',
  },
  moodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  moodButtonSelected: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  moodButtonUnselected: {
    backgroundColor: C.card,
    borderColor: C.border,
  },
  moodButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
