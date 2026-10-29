// ─────────────────────────────────────────────────────────────
//  imagePickerMock.js
//  Cross-platform document/image picker shim.
//
//  On Web:   Creates a hidden <input type="file"> element, triggers
//            click, and resolves with the selected file in the same
//            format as react-native-image-picker's callback.
//
//  On Android/Native: The real react-native-image-picker should be
//            imported instead. This mock is only bundled for web via
//            Webpack alias. For native builds, replace with the real
//            package import.
// ─────────────────────────────────────────────────────────────

/**
 * Launches a file picker dialog.
 *
 * @param {object} options
 *   - mediaType: 'photo' | 'document' | string (ignored in mock; picker always opened)
 *   - accept:    string  — MIME types / extensions to accept (default: 'application/pdf')
 * @returns {Promise<{ assets: Array<{ uri, fileName, type, fileSize, file }> } | { didCancel: true }>}
 */
export function launchImageLibrary(options = {}) {
  return new Promise((resolve) => {
    const accept = options.accept || 'application/pdf';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = (e) => {
      const file = e.target?.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        resolve({ didCancel: true });
        return;
      }

      // Build a data-URL uri so downstream code can display/upload the file
      const reader = new FileReader();
      reader.onload = (ev) => {
        resolve({
          assets: [
            {
              uri: ev.target.result,
              fileName: file.name,
              type: file.type,
              fileSize: file.size,
              // Expose the raw File object so FormData can attach it directly
              file,
            },
          ],
        });
      };
      reader.onerror = () => resolve({ didCancel: true });
      reader.readAsDataURL(file);
    };

    // If the user closes the dialog without selecting, fire didCancel
    // (browsers don't reliably fire 'cancel' on <input>, so we use focus-back)
    const focusBack = () => {
      window.removeEventListener('focus', focusBack);
      // Give the change event a tick to fire first
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
          resolve({ didCancel: true });
        }
      }, 500);
    };
    window.addEventListener('focus', focusBack);

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Alias kept for compatibility.
 */
export const launchCamera = (options = {}) => {
  console.log('launchCamera mock called — not supported in web mode');
  return Promise.resolve({ didCancel: true });
};
