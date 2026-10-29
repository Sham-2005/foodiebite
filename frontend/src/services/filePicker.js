// Fallback for platforms where Metro doesn't resolve a .android.js or .web.js variant.
// In practice this is only hit in test environments or server-side rendering.
export { launchImageLibrary, launchCamera } from './filePicker.web';
