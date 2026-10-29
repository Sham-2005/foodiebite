// ─────────────────────────────────────────────────────────────
//  filePicker.web.js
//  Webpack resolves this file on web in preference to filePicker.js.
//
//  Uses a hidden <input type="file"> to open the browser file picker,
//  restricted to application/pdf only.
//
//  Returns the same shape as filePicker.android.js:
//    { assets: [{ uri (data-url), fileName, type, fileSize, file (raw File) }] }
//    { didCancel: true }  — if user closes dialog without selecting
//
//  Throws on DOM unavailability.
// ─────────────────────────────────────────────────────────────

/**
 * Opens the browser file picker restricted to PDF.
 *
 * @param {object} _options  Ignored on web; kept for API parity with Android.
 * @returns {Promise<{ assets: Array } | { didCancel: true }>}
 */
export function launchImageLibrary(_options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('DOM not available.'));
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';

    let settled = false;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      if (document.body.contains(input)) document.body.removeChild(input);
      window.removeEventListener('focus', onFocusBack);
      resolve(value);
    };

    input.onchange = (e) => {
      const file = e.target?.files?.[0];
      if (!file) { settle({ didCancel: true }); return; }

      // Read as data-URL so uri is available (same as Android's file:// URI)
      const reader = new FileReader();
      reader.onload = (ev) =>
        settle({
          assets: [{
            uri:      ev.target.result,
            fileName: file.name,
            type:     file.type || 'application/pdf',
            fileSize: file.size,
            file,          // raw File object for FormData on web
          }],
        });
      reader.onerror = () => settle({ didCancel: true });
      reader.readAsDataURL(file);
    };

    // Detect dialog close without selection via focus returning to window
    const onFocusBack = () => {
      // Give the change event 600ms to fire first
      setTimeout(() => settle({ didCancel: true }), 600);
    };

    document.body.appendChild(input);
    input.click();

    // Attach focus listener after a tick so the current focus-loss doesn't trigger it
    setTimeout(() => window.addEventListener('focus', onFocusBack, { once: true }), 200);
  });
}

// Alias kept for compatibility
export const launchCamera = (_options = {}) =>
  Promise.resolve({ didCancel: true });
