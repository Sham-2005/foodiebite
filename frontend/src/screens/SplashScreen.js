import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const t = setTimeout(() => navigation.navigate('Onboarding'), 2200);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Logo Wrapper */}
      <View style={styles.logoWrapper}>
        <Image 
          source={require('../assets/logo.jpg')} 
          style={styles.logo}
          resizeMode="cover"
        />
      </View>

      <Text style={styles.title}>FoodieBite</Text>
      <Text style={styles.subtitle}>
        Smart Food Recommendations{"\n"}For You
      </Text>

      {/* Loader */}
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 30,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 0px 30px rgba(255, 107, 53, 0.35)',
      }
    }),
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF6B35',
    marginBottom: 6,
  },
  subtitle: {
    color: '#a0a7b4',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loaderContainer: {
    marginTop: 60,
  },
});
