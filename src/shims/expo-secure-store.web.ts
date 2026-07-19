export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export async function getItemAsync() {
  return null;
}

export async function setItemAsync() {
  throw new Error('Secure storage is available in Ark mobile builds.');
}

export async function deleteItemAsync() {}

export async function isAvailableAsync() {
  return false;
}
