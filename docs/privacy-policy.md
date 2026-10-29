# Privacy Policy for FoodieBite

**Last Updated: May 31, 2026**

Welcome to FoodieBite ("we," "our," or "us"). We value your privacy and are committed to protecting your personal information. This Privacy Policy describes how we collect, use, disclose, and safeguard your data when you use our mobile-first web application.

---

## 1. Information We Collect

We collect information directly from you to deliver a highly personalized nutrition recommendation experience:

### A. Personal & Account Information
- **Account Details**: Full name, email address, password, age, and gender, which are securely registered and managed using **Firebase Authentication**.

### B. Dietary Preferences & Health Goals
- **Profile Context**: User-configured dietary preferences (e.g., Vegetarian, Vegan, Eggetarian, Non-Vegetarian, Keto, Diabetic Friendly), spice tolerance, cuisines, allergies, and health goals (e.g., weight loss, muscle gain) saved securely in **Cloud Firestore**.

### C. Health Documents & Reports
- **Medical Records**: User-uploaded blood panels and health reports, which are uploaded to **Cloudinary** and referenced inside your secure Firestore user document.

---

## 2. How We Use Your Information

We process your data strictly to deliver application features:
- To authenticate your account and persist sessions.
- To compute custom nutrient score rankings (matching regional weather constraints and allergen avoidances) using client-side algorithms.
- To store and display search histories, notification digest statuses, and favorite foods collections.
- We **never** sell, rent, or distribute your personal details, preferences, or medical reports to third parties.

---

## 3. Data Protection & Security

All database transactions are protected by robust cloud security rules:
- **Cloud Firestore**: Rules restrict read/write authorization strictly to the authenticated document owner.
- **Cloudinary CDN**: Access to medical uploads is partitioned securely by user ID.
- **Data Erasure**: You can clear your search log, delete your report documents, or update profile details directly within settings at any time.
