import storage from '../../../storage/storageAdapter.js';

export async function getSetting(key, fallback = null) {
  const value = await storage.settings.get(key);
  return value ?? fallback;
}

export async function setSetting(key, value) {
  await storage.settings.set(key, value);
  return value;
}
