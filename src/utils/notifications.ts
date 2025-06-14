export async function requestNotificationPermission(isIOS: boolean): Promise<boolean> {
  // Skip notification permission on iOS
  if (isIOS) return false;

  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

export function showNotification(title: string, body: string, isIOS: boolean): void {
  // Skip notifications on iOS
  if (isIOS) return;

  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'apple-docs-converter',
      requireInteraction: false,
    });

    // Auto close after 4 seconds
    setTimeout(() => notification.close(), 4000);
  }
}
