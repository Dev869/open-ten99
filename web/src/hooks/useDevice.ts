import { useMemo } from 'react';

export type DevicePlatform = 'ios' | 'android' | 'desktop';
export type DeviceBrowser = 'safari' | 'chrome' | 'firefox' | 'samsung' | 'other';

export interface DeviceInfo {
  platform: DevicePlatform;
  browser: DeviceBrowser;
  isStandalone: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

function detectPlatform(): DevicePlatform {
  const ua = navigator.userAgent;

  // Check iOS: iPhone, iPad, iPod
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'ios';
  }

  // iPad on iOS 13+ reports as Mac with touch support
  if (
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  ) {
    return 'ios';
  }

  // Check Android
  if (/Android/.test(ua)) {
    return 'android';
  }

  return 'desktop';
}

function detectBrowser(): DeviceBrowser {
  const ua = navigator.userAgent;

  // Samsung Internet (check before Chrome since it also contains "Chrome")
  if (/SamsungBrowser/.test(ua)) {
    return 'samsung';
  }

  // Firefox
  if (/Firefox/.test(ua)) {
    return 'firefox';
  }

  // Chrome (but not Edge or Opera which also contain "Chrome")
  if (/Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua)) {
    return 'chrome';
  }

  // Safari (must check after Chrome since Chrome on iOS contains "Safari")
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return 'safari';
  }

  return 'other';
}

function detectStandalone(): boolean {
  // iOS Safari standalone mode
  if ((navigator as unknown as Record<string, unknown>).standalone === true) {
    return true;
  }

  // Standard display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return false;
}

export function useDevice(): DeviceInfo {
  return useMemo(() => {
    const platform = detectPlatform();
    const browser = detectBrowser();
    const isStandalone = detectStandalone();
    const isIOS = platform === 'ios';
    const isAndroid = platform === 'android';
    const isMobile = isIOS || isAndroid;

    return { platform, browser, isStandalone, isMobile, isIOS, isAndroid };
  }, []);
}
