# Google Play Store Data Safety Questionnaire for FoodieBite

This questionnaire lists the exact answers required when submitting the FoodieBite application to the Google Play Console under the **Data Safety** section.

---

## 1. Data Collection and Security

### Do you collect or share any of the required user data types?
- **Yes**.

### Is all of the user data collected by your app encrypted in transit?
- **Yes**. All data is sent over secure HTTPS connections using standard TLS.

### Do you provide a way for users to request that their data be deleted?
- **Yes**. Users can delete reports, clear history, or contact support to request complete database purging.

---

## 2. Collected Data Types & Disclosures

### Category: Personal Info
- **Name**: Collected for account personalization.
- **Email Address**: Collected for unique account authentication and email digest notifications.
- **Other Info (Age, Gender)**: Collected to dynamically calculate nutrient targets.
- **Usage**: **App Functionality, Account Management, Personalization**.

### Category: Health and Fitness
- **Health Information (Medical Reports)**: User-uploaded files.
- **Usage**: **App Functionality, Personalization**. (Private storage, never shared).

### Category: App Activity
- **App Interactions (Search History)**: Search logs to deliver convenient history cards.
- **Usage**: **App Functionality, Personalization**.

---

## 3. Data Sharing
### Do you share any user data with other companies or organizations?
- **No**. All collected data is stored securely in Firestore and Cloudinary, and is **never** shared with third parties.
