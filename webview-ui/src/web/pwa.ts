/**
 * Progressive Web App glue. The only thing registered here is a service worker
 * that precaches the app shell so Log Lens opens and runs fully offline. The SW
 * never sees log data — logs are read through the File API, never fetched — so
 * nothing about your logs is ever cached or sent anywhere.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  // Only meaningful over http(s); skipped on file:// and the like.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is a progressive enhancement; failing to register is fine.
    });
  });
}
