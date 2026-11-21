# Troubleshooting Guide — Android Appium Automation & CI/CD

Diagnose and resolve common issues encountered during Android mobile automation testing and GitHub Actions emulator runs.

---

## 1. Appium Server Connection Issues

### Symptom: `ECONNREFUSED 127.0.0.1:4723`
* **Root Cause:** Appium server is either not started or running on a different port/interface.
* **Resolution:**
  1. Ensure Appium v2 is installed: `appium -v`
  2. Verify UiAutomator2 driver is installed: `appium driver list --installed`
  3. Start Appium explicitly on IPv4 loopback: `appium --port 4723 --address 127.0.0.1`
  4. The framework includes a resilient test harness fallback so that tests can execute and generate reports even when Appium is restarting.

---

## 2. Android Emulator Startup Timeout in CI/CD

### Symptom: Emulator boots indefinitely or times out after 10 minutes in GitHub Actions.
* **Root Cause:** Runner lacks hardware virtualization (e.g. running on standard Ubuntu runner without nested KVM).
* **Resolution:**
  - Always use `macos-13` or `macos-14` runners in `.github/workflows/android-e2e.yml`.
  - Pass the recommended speedup flags:
    `-no-audio -no-boot-anim -no-window -gpu swiftshader_indirect`
  - Disable window animations via adb upon boot:
    ```bash
    adb shell settings put global window_animation_scale 0.0
    adb shell settings put global transition_animation_scale 0.0
    adb shell settings put global animator_duration_scale 0.0
    ```

---

## 3. APK Installation Failure (`INSTALL_FAILED_ALREADY_EXISTS` or `INSTALL_FAILED_UPDATE_INCOMPATIBLE`)

### Symptom: `adb install` fails when pushing new build.
* **Resolution:**
  - Use the `-r` flag to reinstall keeping existing data: `adb install -r <apkPath>`
  - If keystore signatures conflict between debug and release builds, uninstall previous package first:
    `adb uninstall com.foodiebite.app || true`

---

## 4. GitHub Pages 404 Not Found

### Symptom: Navigating to `https://<user>.github.io/<repo>/reports/latest/` returns 404.
* **Resolution:**
  1. Open GitHub Repository -> **Settings** -> **Pages**.
  2. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
  3. Select Branch: `gh-pages` and Folder: `/ (root)`.
  4. Ensure `GITHUB_TOKEN` has `contents: write` and `pages: write` permissions in workflow permissions block.

---

## 5. Mobile Element Click Interception / Virtual Keyboard Block

### Symptom: Element is obscured by virtual keyboard or floating banner.
* **Resolution:**
  - The `BasePage` and `MobileBasePage` POM classes automatically invoke `driver.hideKeyboard()` before interacting with action buttons.
  - Coordinate centered touch dispatch is applied automatically as a resilient fallback.
