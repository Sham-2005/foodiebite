export function addEventListener(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => {
    callback({ isConnected: navigator.onLine });
  };
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  
  // Initial check
  handler();
  
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

export function fetch() {
  if (typeof navigator === 'undefined') {
    return Promise.resolve({ isConnected: true });
  }
  return Promise.resolve({ isConnected: navigator.onLine });
}
