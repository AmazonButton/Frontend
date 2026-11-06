/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const scope = self as unknown as ServiceWorkerGlobalScope;
let enabled = true;
scope.addEventListener('message', event => {
  if (event.data?.type === 'SMART_ORDER_PUSH_DISABLE') enabled = false;
  if (event.data?.type === 'SMART_ORDER_PUSH_ENABLE') enabled = true;
});
scope.addEventListener('push', event => {
  // Stop the SDK's automatic display while a logout cleanup is in progress.
  // Native unsubscribe/unregister below is the durable cleanup; this is an
  // immediate guard for an already-running worker, including offline logout.
  if (!enabled) event.stopImmediatePropagation();
});
// Register before getMessaging installs the SDK's click handler, as required
// for custom click behavior by Firebase's receiving-messages guide.
scope.addEventListener('notificationclick', event => {
  if (!event.notification.data?.smartOrder && !event.notification.data?.FCM_MSG) return;
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil(scope.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const current = clients.find(client => new URL(client.url).origin === scope.location.origin);
    if (current) return current.focus();
    return scope.clients.openWindow('/profile?tab=NOTIFICATIONS');
  }));
});
const config = new URL(scope.location.href).searchParams.get('config');
if (config) {
  const messaging = getMessaging(initializeApp(JSON.parse(config)));
  onBackgroundMessage(messaging, payload => {
    // The SDK already displays notification payloads. Only handle data-only ones.
    if (!enabled || payload.notification) return;
    return scope.registration.showNotification(payload.data?.title || 'Smart Order Button', {
      body: payload.data?.body || payload.data?.message || 'Bạn có thông báo mới.',
      tag: payload.messageId,
      data: { smartOrder: true },
    });
  });
}
