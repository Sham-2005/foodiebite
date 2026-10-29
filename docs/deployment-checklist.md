# FoodieBite Production Deployment Checklist

Use this checklist to ensure all security, database, media, and deployment variables are safely set up before pushing FoodieBite to live servers.

---

## 🔐 1. Firebase Suite Configuration

- [ ] **Firestore Rules**: Verify that [firestore.rules](file:///s:/files/food_app/firestore.rules) has been successfully uploaded to Firestore. Ensure it strictly restricts user profiles (`/users/{userId}`) to `request.auth.uid == userId`.
- [ ] **Firebase Authentication**: Enable the **Email/Password** sign-in method in your Firebase console under Build > Authentication > Sign-in Method.
- [ ] **Cloud Functions**: Deploy the serverless email digest trigger located in the `functions` directory by running:
  ```bash
  firebase deploy --only functions
  ```

---

## ☁️ 2. Cloudinary Storage Configuration

- [ ] **Console Preset Configuration**: Go to your Cloudinary Console > Settings > Upload > Upload Presets.
- [ ] Ensure an **Unsigned Upload Preset** named `ml_default` (or matching your `REACT_APP_CLOUDINARY_UPLOAD_PRESET` env variable) is created and set to active.
- [ ] Set **MIME Type Restrictions** in Cloudinary to allow only image files and PDF documents to prevent malicious script uploads.

---

## 🌐 3. Domain & CORS Configuration

- [ ] **CORS Settings**: Once your live frontend URL is finalized (e.g. `https://foodiebite.web.app`), add the domain to the `allowedOrigins` set in [server.js](file:///s:/files/food_app/backend/src/server.js#L22-L26) to prevent cross-origin resource block errors.
- [ ] **Authorized Domains**: Add your production domain under Firebase Console > Authentication > Settings > Authorized Domains to ensure sign-in requests are permitted.

---

## 📱 4. Play Store Pre-requisites

- [ ] **Listing Data**: Prepare app graphics, screenshots of screens, and populate Play Console settings using templates from [playstore-description.md](file:///s:/files/food_app/docs/playstore-description.md).
- [ ] **Data Safety**: Fill out Play Console Data Safety questionnaire using exact mappings from [playstore-data-safety.md](file:///s:/files/food_app/docs/playstore-data-safety.md).
- [ ] **App Links**: Host legal policy pages on a public URL. The live app paths `/privacy-policy` and `/terms-conditions` serve this perfectly out-of-the-box.
