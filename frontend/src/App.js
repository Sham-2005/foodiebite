import React, { useEffect, useState, Suspense, lazy } from 'react';
import { View, Text, ActivityIndicator, AccessibilityInfo, Easing, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppProvider, useApp } from './context/AppContext';
import { initStorage } from './services/storage';
import DevSupabaseStatus from './components/DevSupabaseStatus';

// Critical core screens loaded eagerly for instant first-paint
import SplashScreen from './screens/SplashScreen';
import HomeScreen from './screens/HomeScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';

// Error Boundary to catch render failures in individual screens gracefully
class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('ScreenErrorBoundary caught error:', error?.message || error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={appStyles.errorContainer}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🍏</Text>
          <Text style={appStyles.errorTitle}>Unable to display this view</Text>
          <Text style={appStyles.errorSubtitle}>
            {this.state.error?.message || 'A temporary rendering issue occurred.'}
          </Text>
          <TouchableOpacity onPress={this.handleReset} style={appStyles.errorBtn} activeOpacity={0.85}>
            <Text style={appStyles.errorBtnText}>Reload View</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Helper to wrap lazy components in Suspense + ErrorBoundary for React Navigation stability
function withLazy(importFn) {
  const LazyComponent = lazy(importFn);
  return function ScreenWrapper(props) {
    return (
      <ScreenErrorBoundary>
        <Suspense fallback={
          <View style={{ flex: 1, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        }>
          <LazyComponent {...props} />
        </Suspense>
      </ScreenErrorBoundary>
    );
  };
}

// On-demand lazy-loaded routes
const LazyOnboardingScreen = withLazy(() => import('./screens/OnboardingScreen'));
const LazyProtectedAdminRoute = withLazy(() => import('./components/ProtectedAdminRoute'));
const LazySearchScreen = withLazy(() => import('./screens/SearchScreen'));
const LazyFoodDetailScreen = withLazy(() => import('./screens/FoodDetailScreen'));
const LazyFavoritesScreen = withLazy(() => import('./screens/FavoritesScreen'));
const LazyProfileScreen = withLazy(() => import('./screens/ProfileScreen'));
const LazyPreferencesScreen = withLazy(() => import('./screens/PreferencesScreen'));
const LazyPersonalInformation = withLazy(() => import('./screens/PersonalInformation'));
const LazyMedicalReportsScreen = withLazy(() => import('./screens/MedicalReportsScreen'));
const LazyRecommendationsAllScreen = withLazy(() => import('./screens/RecommendationsAllScreen'));
const LazyAIScreen = withLazy(() => import('./screens/AIScreen'));
const LazyPrivacyPolicyScreen = withLazy(() => import('./screens/PrivacyPolicyScreen'));
const LazyTermsAndConditionsScreen = withLazy(() => import('./screens/TermsAndConditionsScreen'));
const LazyCompleteProfileScreen = withLazy(() => import('./screens/CompleteProfileScreen'));
const LazyAboutUsScreen = withLazy(() => import('./screens/AboutUsScreen'));
const LazyFeedbackScreen = withLazy(() => import('./screens/FeedbackScreen'));
const LazyCompareScreen = withLazy(() => import('./screens/CompareScreen'));
const LazyChatScreen = withLazy(() => import('./screens/ChatScreen'));
const LazyAnalyticsScreen = withLazy(() => import('./screens/AnalyticsScreen'));
const LazyNutritionScannerScreen = withLazy(() => import('./screens/NutritionScannerScreen'));
const LazyAuthCallbackScreen = withLazy(() => import('./screens/AuthCallbackScreen'));

const Stack = createStackNavigator();

function AppContent() {
  const { user, authLoading } = useApp();
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    async function init() {
      await initStorage();
      setStorageHydrated(true);
    }
    init();

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => setReduceMotion(enabled))
      .catch(() => { });

    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      setReduceMotion(enabled);
    });

    return () => {
      if (motionSub && typeof motionSub.remove === 'function') {
        motionSub.remove();
      }
    };
  }, []);

  if (authLoading || !storageHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🍏</Text>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={{ color: '#6f7785', fontSize: 13, marginTop: 12 }}>Loading secure session...</Text>
      </View>
    );
  }

  const cleanEmail = (user?.email || '').trim().toLowerCase();
  const isAdminUser = Boolean(
    user &&
    (user.role === 'admin' || (user.role !== 'user' && cleanEmail === 'sham111205s@gmail.com'))
  );
  const hasCompletedProfile =
    isAdminUser || (user && (user.profileCompleted === true || (!!user.age && !!user.gender)));

  const initialRoute = !user
    ? "Splash"
    : isAdminUser
      ? "Admin"
      : !hasCompletedProfile
        ? "CompleteProfile"
        : "Home";

  // Unified smooth page transitions (fade-in + slight horizontal slide in 200-250ms)
  const screenTransitionOptions = reduceMotion
    ? {
      headerShown: false,
      cardStyle: { backgroundColor: '#111318' },
      transitionSpec: {
        open: { animation: 'timing', config: { duration: 0 } },
        close: { animation: 'timing', config: { duration: 0 } },
      },
    }
    : {
      headerShown: false,
      cardStyle: { backgroundColor: '#111318' },
      detachPreviousScreen: false,
      transitionSpec: {
        open: {
          animation: 'timing',
          config: {
            duration: 250,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        },
        close: {
          animation: 'timing',
          config: {
            duration: 220,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
          },
        },
      },
      cardStyleInterpolator: ({ current, next, layouts }) => {
        const progress = current.progress;
        const screenWidth = layouts?.screen?.width || 360;

        // Subtle horizontal slide (24px to 0px)
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [Math.min(screenWidth * 0.08, 28), 0],
          extrapolate: 'clamp',
        });

        // Smooth fade in
        const opacity = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });

        // Subtle parallax fade when another screen pushes on top
        const exitOpacity = next
          ? next.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.92],
            extrapolate: 'clamp',
          })
          : 1;

        return {
          cardStyle: {
            opacity: next ? exitOpacity : opacity,
            transform: [{ translateX }],
            backgroundColor: '#111318',
          },
        };
      },
    };

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={screenTransitionOptions}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={LazyOnboardingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="AuthCallback" component={LazyAuthCallbackScreen} />
      <Stack.Screen name="AuthCallbackAlt" component={LazyAuthCallbackScreen} />
      <Stack.Screen name="CompleteProfile" component={LazyCompleteProfileScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Admin" component={LazyProtectedAdminRoute} />
      <Stack.Screen name="Search" component={LazySearchScreen} />
      <Stack.Screen name="Preferences" component={LazyPreferencesScreen} />
      <Stack.Screen name="FoodDetail" component={LazyFoodDetailScreen} />
      <Stack.Screen name="Favorites" component={LazyFavoritesScreen} />
      <Stack.Screen name="Profile" component={LazyProfileScreen} />
      <Stack.Screen name="AI" component={LazyAIScreen} />
      <Stack.Screen name="PersonalInfo" component={LazyPersonalInformation} />
      <Stack.Screen name="MedicalReports" component={LazyMedicalReportsScreen} />
      <Stack.Screen name="RecommendationsAll" component={LazyRecommendationsAllScreen} />
      <Stack.Screen name="PrivacyPolicy" component={LazyPrivacyPolicyScreen} />
      <Stack.Screen name="TermsConditions" component={LazyTermsAndConditionsScreen} />
      <Stack.Screen name="AboutUs" component={LazyAboutUsScreen} />
      <Stack.Screen name="Feedback" component={LazyFeedbackScreen} />
      <Stack.Screen name="Compare" component={LazyCompareScreen} />
      <Stack.Screen name="Chat" component={LazyChatScreen} />
      <Stack.Screen name="Analytics" component={LazyAnalyticsScreen} />
      <Stack.Screen name="NutritionScanner" component={LazyNutritionScannerScreen} />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: [
    ...(typeof window !== 'undefined' && window.location && window.location.origin ? [window.location.origin] : []),
    'https://sham-2005.github.io/foodiebite',
    'https://sham-2005.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'foodiebite://',
    '/'
  ],
  config: {
    screens: {
      Admin: 'admin',
      SignIn: 'signin',
      SignUp: 'signup',
      Home: 'home',
      Profile: 'profile',
      Compare: 'compare',
      NutritionScanner: 'scanner',
      AuthCallback: 'auth/callback',
      AuthCallbackAlt: 'auth-callback',
      CompleteProfile: 'complete-profile',
      Preferences: 'preferences',
      Favorites: 'favorites',
      Search: 'search',
    }
  }
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <NavigationContainer linking={linking}>
          <AppContent />
          {typeof __DEV__ !== 'undefined' && __DEV__ && <DevSupabaseStatus />}
        </NavigationContainer>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const appStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#8f97a6',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  errorBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  errorBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
