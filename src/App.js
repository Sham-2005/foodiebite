import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import SplashScreen      from './screens/SplashScreen';
import OnboardingScreen  from './screens/OnboardingScreen';
import SignInScreen      from './screens/SignInScreen';
import SignUpScreen      from './screens/SignUpScreen';
import PreferencesScreen from './screens/PreferencesScreen';
import HomeScreen        from './screens/HomeScreen';
import SearchScreen      from './screens/SearchScreen';
import FoodDetailScreen  from './screens/FoodDetailScreen';
import FavoritesScreen   from './screens/FavoritesScreen';
import ProfileScreen     from './screens/ProfileScreen';
import PersonalInformation from './screens/PersonalInformation';
import MedicalReportsScreen from './screens/MedicalReportsScreen';
import RecommendationsAllScreen from './screens/RecommendationsAllScreen';
import AIScreen from './screens/AIScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermsAndConditionsScreen from './screens/TermsAndConditionsScreen';
import CompleteProfileScreen from './screens/CompleteProfileScreen';
import AboutUsScreen from './screens/AboutUsScreen';
import FeedbackScreen from './screens/FeedbackScreen';


function VerificationGuard({ children }) {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111318', height: '100vh', color: '#fff' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>🍏</div>
        <p style={{ color: '#666', fontSize: 13 }}>Loading secure session...</p>
      </div>
    );
  }

  // Redirect if logged in but profile is incomplete (missing age or gender)
  if (user && (!user.age || !user.gender)) {
    return <Navigate to="/complete-profile" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <BrowserRouter>
          <Routes>
            <Route path="/"             element={<SplashScreen />} />
            <Route path="/onboarding"   element={<OnboardingScreen />} />
            <Route path="/signin"       element={<SignInScreen />} />
            <Route path="/signup"       element={<SignUpScreen />} />
            <Route path="/complete-profile" element={<CompleteProfileScreen />} />
            
            {/* Secured Private Routes */}
            <Route path="/preferences"  element={<VerificationGuard><PreferencesScreen /></VerificationGuard>} />
            <Route path="/home"         element={<VerificationGuard><HomeScreen /></VerificationGuard>} />
            <Route path="/search"       element={<VerificationGuard><SearchScreen /></VerificationGuard>} />
            <Route path="/food/:id"     element={<VerificationGuard><FoodDetailScreen /></VerificationGuard>} />
            <Route path="/favorites"    element={<VerificationGuard><FavoritesScreen /></VerificationGuard>} />
            <Route path="/profile"         element={<VerificationGuard><ProfileScreen /></VerificationGuard>} />
            <Route path="/ai"              element={<VerificationGuard><AIScreen /></VerificationGuard>} />
            <Route path="/personal-info"   element={<VerificationGuard><PersonalInformation /></VerificationGuard>} />
            <Route path="/medical-reports" element={<VerificationGuard><MedicalReportsScreen /></VerificationGuard>} />
            <Route path="/recommendations-all" element={<VerificationGuard><RecommendationsAllScreen /></VerificationGuard>} />
            <Route path="/privacy-policy"      element={<VerificationGuard><PrivacyPolicyScreen /></VerificationGuard>} />
            <Route path="/terms-conditions"    element={<VerificationGuard><TermsAndConditionsScreen /></VerificationGuard>} />
            <Route path="/about-us"            element={<VerificationGuard><AboutUsScreen /></VerificationGuard>} />
            <Route path="/feedback"            element={<VerificationGuard><FeedbackScreen /></VerificationGuard>} />
            
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AppProvider>
  );
}
