import { api } from '../api';

export const uploadBase64ToStorage = async (base64String: string, basePath: string): Promise<string> => {
  return await api.uploadBlob(base64String, basePath);
};

export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage access denied or failed', e);
    return null;
  }
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage set failed', e);
  }
};
