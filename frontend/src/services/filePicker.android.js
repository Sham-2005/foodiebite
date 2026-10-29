// ─────────────────────────────────────────────────────────────
//  filePicker.android.js
//  Metro resolves this file on Android in preference to filePicker.js.
//
//  Uses react-native-document-picker to open the system file manager,
//  restricted to application/pdf only.
//
//  Returns the same shape as launchImageLibrary in react-native-image-picker:
//    { assets: [{ uri, fileName, type, fileSize }] }  — on success
//    { didCancel: true }                               — if user cancelled
//
//  Throws on permission denial or other hard errors.
// ─────────────────────────────────────────────────────────────

import DocumentPicker, { types } from 'react-native-document-picker';

/**
 * Opens the Android system document picker restricted to PDF files.
 *
 * @param {object} _options  Ignored on Android; kept for API parity with web.
 * @returns {Promise<{ assets: Array } | { didCancel: true }>}
 */
export async function launchImageLibrary(_options = {}) {
  try {
    const [result] = await DocumentPicker.pick({
      type: [types.pdf],
      allowMultiSelection: false,
      copyTo: 'cachesDirectory',  // Gives a file:// URI Metro can read
    });

    return {
      assets: [
        {
          uri:      result.copyError ? result.uri : (result.fileCopyUri || result.uri),
          fileName: result.name,
          type:     result.type || 'application/pdf',
          fileSize: result.size,
        },
      ],
    };
  } catch (err) {
    if (DocumentPicker.isCancel(err)) {
      return { didCancel: true };
    }
    // Re-throw permission errors and other hard failures
    throw err;
  }
}

// Alias kept for compatibility
export const launchCamera = async (_options = {}) => ({ didCancel: true });
