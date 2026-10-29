import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BtnOrange, C } from '../components/UI';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🥗',
    headline: 'Personalized Food for',
    highlight: 'a Better You',
    body: 'Get AI powered food recommendations based on your preferences, health goals and lifestyle.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  },
  {
    emoji: '🌦️',
    headline: 'Smart Weather &',
    highlight: 'Season Matching',
    body: "Eat right for the season. Our engine picks meals perfect for today's temperature and weather.",
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=80',
  },
  {
    emoji: '💪',
    headline: 'Fuel Your',
    highlight: 'Health Goals',
    body: 'Whether gym, yoga, or weight loss — every recommendation is tailored to your body and goals.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const navigation = useNavigation();
  const slide = SLIDES[index];

  return (
    <View style={styles.container}>
      {/* Image Media Container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: slide.image }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Bottom linear gradient shadow equivalent overlay */}
        <View style={styles.gradientOverlay} />
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headline}>
            {slide.headline}{' '}
            <Text style={{ color: C.orange }}>{slide.highlight}</Text>
          </Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        {/* Indicator Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setIndex(i)}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {index === SLIDES.length - 1 ? (
          <BtnOrange onClick={() => navigation.navigate('SignUp')}>Get Started</BtnOrange>
        ) : (
          <BtnOrange onClick={() => setIndex(i => Math.min(i + 1, SLIDES.length - 1))}>Next</BtnOrange>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('SignUp')}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111318',
  },
  imageContainer: {
    flex: 1.2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(17,19,24,0.95)', // Simulated gradient
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 36,
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: '#a0a7b4',
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 28,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
    backgroundColor: C.orange,
  },
  dotInactive: {
    width: 7,
    backgroundColor: '#333',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  skipText: {
    color: '#6f7785',
    fontSize: 14,
    fontWeight: '600',
  },
});
