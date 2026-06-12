import { Capacitor } from '@capacitor/core';

export const isCapacitorNative = () => Capacitor.isNativePlatform();
