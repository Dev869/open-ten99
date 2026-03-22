import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;

  const supported = await isSupported();
  if (!supported) return null;

  const { app } = await import('./firebase');
  // getMessaging needs the same app instance
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getPushPermissionState(): PushPermissionState {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  // Register the FCM service worker
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  return token;
}

export async function getCurrentToken(): Promise<string | null> {
  if (getPushPermissionState() !== 'granted') return null;

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) return null;

    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch {
    return null;
  }
}
