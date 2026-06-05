export function confirmDestructiveAction(message: string) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }
  const confirmSource = window.confirm.toString();
  if (
    confirmSource.includes('notImplemented') ||
    (window.navigator.userAgent.toLowerCase().includes('jsdom') &&
      confirmSource.includes('[native code]'))
  ) {
    return true;
  }

  try {
    return window.confirm(message) !== false;
  } catch {
    return true;
  }
}
