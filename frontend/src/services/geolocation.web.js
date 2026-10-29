export function getCurrentPosition(success, error, options) {
  if (navigator && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error, options);
  } else {
    if (error) error(new Error('Geolocation is not supported by this browser.'));
  }
}
