<USER_REQUEST>
# FoodieBite — Fix Admin Medical Report Visibility & Local AI Clinical Summary

## Objective

Fix the discrepancy between the user's uploaded medical reports and the Admin Dashboard.

Currently:

- In the FoodieBite user profile, under **Profile → Medical Scans**, the user has uploaded a medical report. The badge shows **1**.
- In **Admin Dashboard → Users → Individual User Details**, the Reports count shows **0**.
- The Medical Reports & Clinical Intelligence section does not display the uploaded report or its analysis.

The report already exists and is visible to the user. The Admin dashboard must retrieve and display the exact same report.

---

## Phase 1 — Investigate the Actual Report Data Flow

Before changing code, investigate the complete data flow:

1. Identify the exact API endpoint used by the user to upload medical reports.
2. Identify where medical report metadata is stored.
3. Identify where the uploaded document/file is stored.
4. Identify the database table, bucket, and storage path used.
5. Identify how the user's uploaded reports are fetched in:
   - Profile → Medical Scans
   - Admin → Users → Individual User Details
6. Compare the authenticated user ID used during upload with the user ID used by the Admin dashboard.
7. Investigate why the user's Profile shows 1 report but Admin shows 0.
8. Check whether the Admin endpoint is:
   - Querying the wrong table
   - Using the wrong user ID
   - Using an incorrect relationship
   - Filtering out uploaded reports
   - Failing due to Row Level Security
   - Using an incorrect Supabase query
   - Returning a response format the frontend doesn't understand
   - Failing to retrieve reports uploaded through the current medical scan flow

**Do not create duplicate medical reports or fake records. Fix the existing data retrieval and relationship.**

---

## Phase 2 — Fix Admin Report Retrieval

The Admin dashboard must retrieve the actual medical reports uploaded by the selected user.

Requirements:

- Admin should see the same report records that the user sees in their Medical Scans page.
- Use the correct user ID and database relationship.
- Preserve the existing medical report records.
- Do not create duplicate uploads.
- Ensure the report count in the Admin user list reflects the real number of uploaded reports.
- The individual user's report count must be dynamically calculated from the actual report records.
- Refreshing the Admin dashboard must not cause the report count to become incorrect.
- Support users with multiple uploaded reports.

The Admin Medical Reports section must display:

- Report title or filename
- Upload date
- File type
- Report status
- Analysis status
- View report button
- Analyze report button, if analysis has not been completed
- View AI summary button, if analysis is complete

---

## Phase 3 — Local AI Medical Report Analysis

Once the Admin opens an uploaded report, provide an option to analyze it using the existing **local AI engine**.

### AI Requirement

Use FoodieBite's existing local AI infrastructure.

Do not use:

- OpenAI
- Gemini
- Claude
- Groq
- TARS
- External AI APIs
- Paid AI services

The analysis must run using the locally configured Ollama/local model infrastructure already present in FoodieBite.

First inspect the existing medicalReportAiService and local AI configuration. Reuse existing implementations wherever possible instead of creating another AI service.

### Analysis Workflow

1. Admin selects a user.
2. Admin opens the Medical Reports section.
3. Admin selects an uploaded report.
4. Admin clicks **Analyze Report**.
5. Backend securely retrieves the actual report file.
6. Extract text using the existing OCR/PDF/document extraction system.
7. Send the extracted text to the existing local AI model.
8. Generate a structured health summary.
9. Save the analysis against the correct medical report.
10. Display the analysis in the Admin dashboard.

The analysis must not depend on the user manually typing the report contents.

---

## Phase 4 — AI Analysis Output

Generate an understandable description of the report using the following structure:

### 1. Overall Summary
A simple-language summary explaining what the report indicates overall.

### 2. Health Indicators
Important health indicators found in the report.

### 3. Abnormal Results
Values outside the reference range.

For each abnormal value, include:

- Test name
- Reported value
- Unit
- Reference range
- High/low indication
- Simple explanation of what it may indicate

### 4. Normal Results
Important values within their stated reference ranges.

### 5. Potential Health Concerns
Explain potential concerns suggested by the report, without presenting them as confirmed diagnoses.

### 6. Nutritional Considerations
Possible nutrition-related considerations based on the report.

### 7. FoodieBite Dietary Recommendations
Suggest relevant food categories and dietary considerations.

Recommendations should be compatible with the user's existing FoodieBite profile, including:

- Diet preference
- Allergies
- Dietary restrictions
- Spice level
- Health goals

### 8. Recommended Follow-Up
Identify values or findings the user may want to discuss with a qualified healthcare professional.

### 9. Report Information
Display:

- Report date, if available
- Upload date
- Analysis date
- Analysis model used

---

## Phase 5 — Admin UI

Under:

**Admin Dashboard → Users → Select User → Medical Reports & Clinical Intelligence**

Implement a clean interface.

### Report List

Each uploaded report should appear as a card containing:

- Document icon
- Report filename
- Uploaded date
- Report type
- Analysis status
- View Document button
- Analyze button

### Analysis Interface

When the report has been analyzed, display the AI-generated results in a structured, readable layout.

Use:

- Clear section headings
- Expandable sections where appropriate
- High/Low badges for abnormal values
- Normal badges for normal values
- Appropriate warning indicators
- Clean spacing
- Responsive design

Do not display raw JSON to the Admin.

---

## Phase 6 — Secure Report Access

Medical reports are sensitive information.

Ensure:

- Only the authorized Admin can access reports from other users.
- Admin API routes use existing cryptographic authentication and strict Admin authorization.
- Do not make medical reports publicly accessible.
- Do not expose Supabase service-role credentials to the frontend.
- Use private storage.
- Generate short-lived signed URLs when viewing files.
- Validate report ownership and report ID before retrieving or analyzing.
- Prevent access to reports belonging to unrelated users.
- Do not expose medical report contents in unnecessary server logs.
- Do not expose report text in frontend console logs.
- Preserve existing user-level access controls.

---

## Phase 7 — Fix Report Counts

In Admin → Users list:

The Reports column must accurately show the number of reports uploaded by each user.

Example:

| User | Uploaded Reports |
|---|---:|
| User A | 1 |
| User B | 3 |
| User C | 0 |

The count must come from actual report records, not manually entered or hardcoded values.

Make sure the same count appears consistently in:

- Admin user table
- Individual user details
- Medical Reports section

---

## Phase 8 — Error Handling

Implement clear error handling for:

- No reports uploaded
- Report metadata exists but file is missing
- OCR failure
- Unsupported document format
- Local AI model unavailable
- Local AI analysis timeout
- Failed database query
- Unauthorized Admin access
- Failed signed URL generation

The UI must distinguish between:

**No reports uploaded**

and

**Unable to retrieve reports**

These are not the same state.

---

## Phase 9 — Testing

Create or update automated tests covering:

### Report Retrieval
- User has 1 report → Admin displays 1.
- User has multiple reports → Admin displays all.
- User has no reports → Admin displays 0.
- Report uploaded from User Profile is visible in Admin.
- Correct user ID is used.
- No duplicate reports appear.

### AI Analysis
- Existing uploaded report can be analyzed.
- Text extraction works.
- Local AI generates a summary.
- Structured output is correctly parsed.
- Analysis is saved.
- Previously analyzed reports can be reopened.
- Re-analysis works where permitted.
- Local AI unavailable → appropriate error state.

### Security
- Unauthorized users cannot access Admin medical reports.
- Admin can access the selected user's reports.
- Users cannot access another user's reports.
- Storage remains private.
- Signed URLs expire.

### UI
- Report count is correct.
- Report card is visible.
- View Report works.
- Analyze Report works.
- Analysis summary displays correctly.
- Loading, empty, and error states are correct.

---

## Phase 10 — Final Verification

Do not stop after changing the code.

Run:

- Backend tests
- Medical report retrieval tests
- Admin authorization tests
- Local AI integration tests
- Frontend build
- API integration tests

Then verify the actual workflow:

1. Log in to FoodieBite using the account that uploaded the medical report.
2. Confirm the report is visible under Profile → Medical Scans.
3. Log in to Admin.
4. Open Admin → Users.
5. Select the same user.
6. Confirm Reports count shows **1**.
7. Confirm the actual uploaded document appears.
8. Open the report.
9. Click **Analyze Report**.
10. Confirm the local AI model analyzes the actual report.
11. Confirm the generated health description appears.
12. Refresh Admin and verify the report and saved analysis remain available.

## Final Deliverable

Provide a technical report containing:

- Root cause of the discrepancy
- Database table and relationship involved
- API endpoints fixed
- Files modified
- Security changes
- Local AI model used
- OCR/document extraction method
- Test results
- Frontend build results
- Actual end-to-end verification results

**Important:** The goal is to make the Admin dashboard display and analyze the user's actual uploaded medical report—not merely to make the report count display 1 or to create a placeholder report.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-25T17:20:54+05:30.

The user's current state is as follows:
Active Document: s:\files\food_app\backend\.env (LANGUAGE_UNSPECIFIED)
Cursor is on line: 29
Other open documents:
- s:\files\food_app\backend\scripts\runEmailEndpointTest.js (LANGUAGE_UNSPECIFIED)
- s:\files\food_app\backend\scripts\testEmailEndpoint.js (LANGUAGE_UNSPECIFIED)
- s:\files\food_app\backend\scripts\verifyRoutes.js (LANGUAGE_UNSPECIFIED)
- s:\files\food_app\functions\index.js (LANGUAGE_UNSPECIFIED)
- s:\files\food_app\backend\.env.example (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>