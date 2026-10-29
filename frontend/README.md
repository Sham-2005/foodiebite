# FoodieBite — MVP Frontend

Dark-themed food recommendation app. 10 screens matching the design reference.

## Quick Start

```bash
cd foodiebite
npm install
npm start
```

Opens at http://localhost:3000

---

## Screen Flow

```
/ (Splash)
  └── /onboarding
        ├── /signin  ──────→ /home
        └── /signup  ──────→ /preferences ──→ /home
```

### From /home (bottom nav)
| Route          | Screen                |
|----------------|-----------------------|
| /home          | 6. Home               |
| /search        | 7. Search             |
| /food/:id      | 8. Food Details       |
| /favorites     | 9. Favorites          |
| /nearby        | Nearby (map coming)   |
| /profile       | 10. Profile/Settings  |

---

## Project Structure

```
src/
├── App.js                     ← Router
├── index.js / index.css       ← Entry + global styles
├── context/
│   └── AppContext.js           ← Global state (user, prefs, favorites)
├── data/
│   └── mockData.js             ← All mock food, restaurant, category data
├── components/
│   ├── UI.js                   ← Shared components (Button, Input, Cards, etc.)
│   ├── BottomNav.js            ← Bottom navigation bar
│   └── AppLayout.js            ← Layout wrapper with BottomNav
└── screens/
    ├── SplashScreen.js
    ├── OnboardingScreen.js
    ├── SignInScreen.js
    ├── SignUpScreen.js
    ├── PreferencesScreen.js
    ├── HomeScreen.js
    ├── SearchScreen.js
    ├── FoodDetailScreen.js
    ├── FavoritesScreen.js
    ├── NearbyScreen.js
    └── ProfileScreen.js
```

---

## MVP Notes (Backend Hooks)

| Feature              | Current (MVP)         | → Backend needed         |
|----------------------|-----------------------|--------------------------|
| Sign In / Sign Up    | Any input works       | POST /auth/login, /signup|
| Food Data            | mockData.js           | GET /foods?season=&weather=|
| Favorites            | React Context (RAM)   | POST/DELETE /favorites   |
| Preferences          | React Context         | PUT /user/preferences    |
| Food Details         | Static JSON           | GET /foods/:id           |
| Nearby               | Static list           | GET /restaurants?lat=&lng=|
| Medical Reports      | UI only               | POST /user/medical       |
| Cart / Add to Cart   | Button only           | POST /cart               |

---

## Design System

- **Brand**: `#FF6B35` (orange)
- **Background**: `#111111`
- **Card**: `#1e1e1e`
- **Font**: Inter (Google Fonts)
- **Max Width**: 430px (mobile-first)
