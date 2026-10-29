# FoodieBite Backend — Phase 2

Node.js + Express + MongoDB REST API

---

## Setup & Run

### 1. Install MongoDB
- Download: https://www.mongodb.com/try/download/community
- Start: `mongod` (or it runs as a service automatically)

### 2. Install dependencies
```bash
cd foodiebite-backend
npm install
```

### 3. Configure .env
Edit `.env` — the defaults work for local MongoDB:
```
MONGO_URI=mongodb://localhost:27017/foodiebite
JWT_SECRET=foodiebite_super_secret_key_change_in_production_2024
PORT=5000
CLIENT_URL=http://localhost:3000
```

### 4. Run the server
```bash
# Development (auto-restart on change)
npm run dev

# Production
npm start
```

Server runs at → http://localhost:5000

---

## All API Endpoints

### Auth
| Method | Route                  | Description              | Auth |
|--------|------------------------|--------------------------|------|
| POST   | /api/auth/register     | Register new user        | ❌   |
| POST   | /api/auth/login        | Login user               | ❌   |
| GET    | /api/auth/me           | Get current user         | ✅   |
| PUT    | /api/auth/password     | Update password          | ✅   |

### User
| Method | Route                              | Description                | Auth |
|--------|------------------------------------|----------------------------|------|
| GET    | /api/user/profile                  | Get profile                | ✅   |
| PUT    | /api/user/profile                  | Update profile             | ✅   |
| GET    | /api/user/preferences              | Get preferences            | ✅   |
| PUT    | /api/user/preferences              | Update preferences         | ✅   |
| GET    | /api/user/favorites                | Get all favorites          | ✅   |
| POST   | /api/user/favorites/food           | Add food favorite          | ✅   |
| DELETE | /api/user/favorites/food/:foodId   | Remove food favorite       | ✅   |
| POST   | /api/user/favorites/restaurant     | Add restaurant favorite    | ✅   |
| DELETE | /api/user/favorites/restaurant/:id | Remove restaurant favorite | ✅   |
| GET    | /api/user/medical                  | Get medical reports        | ✅   |
| POST   | /api/user/medical                  | Upload medical report      | ✅   |
| DELETE | /api/user/medical/:reportId        | Delete medical report      | ✅   |
| GET    | /api/user/search-history           | Get search history         | ✅   |
| DELETE | /api/user/search-history           | Clear search history       | ✅   |

### Food
| Method | Route                       | Description                        | Auth     |
|--------|-----------------------------|------------------------------------|----------|
| GET    | /api/food/recommendations   | Get personalised recommendations   | ✅       |
| GET    | /api/food/search?q=chicken  | Search foods (saves history)       | Optional |
| GET    | /api/food/:barcode          | Get food by barcode                | ❌       |

---

## Frontend .env
Add this to `foodiebite/.env`:
```
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Project Structure
```
foodiebite-backend/
├── .env
├── package.json
├── uploads/              ← medical report files stored here
└── src/
    ├── server.js          ← Express app entry
    ├── config/
    │   └── db.js          ← MongoDB connection
    ├── models/
    │   ├── User.js        ← User schema (prefs, favorites, medical)
    │   └── SearchHistory.js
    ├── controllers/
    │   ├── authController.js
    │   ├── userController.js
    │   └── foodController.js  ← Open Food Facts proxy + filter/rank
    ├── routes/
    │   ├── auth.js
    │   ├── user.js
    │   └── food.js
    └── middleware/
        ├── auth.js          ← JWT protect + generateToken
        ├── errorHandler.js
        └── upload.js        ← Multer config
```

---

## Phase 3 (Next)
- OpenWeatherMap API integration
- Season-based food engine
- Medical report AI analysis
- Push notifications
