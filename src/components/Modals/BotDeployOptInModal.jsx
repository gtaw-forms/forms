/**
 * Bot Deploy Opt-In — saved to localStorage.
 * Used by the sidebar toggle and useFormSaver.
 */

const STORAGE_KEY = 'botDeployOptIn';

export function getBotDeployPref() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setBotDeployPref(value) {
  localStorage.setItem(STORAGE_KEY, value);
}

export function isBotDeployOptedIn() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
