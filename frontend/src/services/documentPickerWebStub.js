// ─────────────────────────────────────────────────────────────
//  documentPickerWebStub.js
//  Webpack alias target for 'react-native-document-picker'.
//
//  react-native-document-picker is a native-only Android/iOS module.
//  This stub is aliased in webpack.config.js so the web bundle never
//  tries to import the real native module (which has no web implementation).
//
//  In practice this module is never called on web — filePicker.web.js
//  (which Webpack resolves before filePicker.android.js) does not import
//  react-native-document-picker. This file exists purely as a safety net
//  in case a code path ever imports it directly on the web bundle.
// ─────────────────────────────────────────────────────────────

const DocumentPicker = {
  pick: () => Promise.reject(new Error('DocumentPicker is not available on web.')),
  pickSingle: () => Promise.reject(new Error('DocumentPicker is not available on web.')),
  isCancel: (err) => err && err.message === 'user canceled',
  types: {
    pdf: 'application/pdf',
    images: 'image/*',
    plainText: 'text/plain',
    allFiles: '*/*',
  },
};

export default DocumentPicker;
export const types = DocumentPicker.types;
