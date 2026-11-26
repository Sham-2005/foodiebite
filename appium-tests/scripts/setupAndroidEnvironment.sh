#!/usr/bin/env bash
echo "=========================================================="
echo "  FoodieBite Android Appium Environment Verification"
echo "=========================================================="
if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js is installed: $(node -v)"
else
    echo "[FAIL] Node.js is not installed."
fi
if command -v java >/dev/null 2>&1; then
    echo "[OK] Java JDK is installed: $(java -version 2>&1 | head -n 1)"
else
    echo "[FAIL] Java JDK is not installed."
fi
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    echo "[OK] ANDROID_HOME is set: $ANDROID_HOME"
else
    echo "[WARN] ANDROID_HOME is not set or missing."
fi
if command -v appium >/dev/null 2>&1; then
    echo "[OK] Appium is installed: $(appium --version)"
else
    echo "[INFO] Appium CLI not installed globally."
fi
echo "=========================================================="
