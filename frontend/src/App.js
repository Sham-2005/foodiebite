import React, { useEffect, useState, Suspense, lazy } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppProvider, useApp } from './context/AppContext';
import { hydrateLocalStorage } from './services/localStoragePolyfill';

// Critical core screens loaded eagerly for instant first-paint
import SplashScreen from './screens/SplashScreen';
import HomeScreen from './screens/HomeScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';

// Helper to wrap lazy components in Suspense for React Navigation compatibility
function withLazy(importFn) {
  const LazyComponent = lazy(importFn);
  return function ScreenWrapper(props) {
    return (
      <Suspense fallback={
        <View style={{ flex: 1, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#FF6B35" />
        </View>
      }>
        <LazyComponent {...props} />
      </Suspense>
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

const Stack = createStackNavigator();

function AppContent() {
  const { user, authLoading } = useApp();
  const [storageHydrated, setStorageHydrated] = useState(false);

  useEffect(() => {
    async function init() {
      await hydrateLocalStorage();
      setStorageHydrated(true);
    }
    init();
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
  const isAdminUser = cleanEmail === 'sham111205s@gmail.com';
  const hasCompletedProfile =
    isAdminUser || (user && (user.profileCompleted === true || (!!user.age && !!user.gender)));

  return (
    <Stack.Navigator
      initialRouteName={!user ? "Splash" : (isAdminUser ? "Admin" : "Home")}
      screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#111318' } }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={LazyOnboardingScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Admin" component={LazyProtectedAdminRoute} />
          <Stack.Screen name="NutritionScanner" component={LazyNutritionScannerScreen} />
        </>
      ) : isAdminUser ? (
        <>
          <Stack.Screen name="Admin" component={LazyProtectedAdminRoute} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
        </>
      ) : !hasCompletedProfile ? (
        <Stack.Screen name="CompleteProfile" component={LazyCompleteProfileScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
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
        </>
      )}
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['http://localhost:3000', 'http://127.0.0.1:3000', '/'],
  config: {
    screens: {
      Admin: 'admin',
      SignIn: 'signin',
      SignUp: 'signup',
      Home: 'home',
      Profile: 'profile',
      Compare: 'compare',
      NutritionScanner: 'scanner'
    }
  }
};

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer linking={linking}>
        <AppContent />
      </NavigationContainer>
    </AppProvider>
  );
}
