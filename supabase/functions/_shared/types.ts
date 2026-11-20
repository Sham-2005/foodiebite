// ─────────────────────────────────────────────────────────────
//  supabase/functions/_shared/types.ts
//  FoodieBite Email System Shared Types
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
  diet_type?: string;
  dietType?: string;
  age?: number | string;
  gender?: string;
  preferences?: {
    dietType?: string;
    spiceLevel?: string;
    cuisines?: string[];
    healthGoals?: string[];
    allergies?: string[];
    city?: string;
    latitude?: number;
    longitude?: number;
    [key: string]: any;
  };
}

export interface EmailPreferences {
  id?: string;
  user_id: string;
  email_enabled: boolean;
  welcome_email_sent: boolean;
  daily_email_enabled: boolean;
  preferred_delivery_time: string;
  timezone: string;
  last_daily_email_sent?: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  conditionCategory: 'clear' | 'cloudy' | 'rainy' | 'cold' | 'mild' | 'hot' | 'warm';
  locationLabel: string;
  season: string;
  isRainy: boolean;
  available: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  category?: string;
  cuisine?: string;
  reason?: string;
}

export interface DailyRecommendations {
  breakfast: FoodItem;
  lunch: FoodItem;
  dinner: FoodItem;
  snacks: FoodItem;
  whySelected: string;
  dailyTip: string;
}
