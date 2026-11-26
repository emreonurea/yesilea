// Küçük anahtar-değer deposu: web'de tarayıcının yerel deposu, telefonda SecureStore.
// Web'de SecureStore çalışmadığı için tüm kalıcı küçük ayarlar buradan geçer.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();

function webStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return webStorage()?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function kvSet(key: string, value: string | null): Promise<void> {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  if (Platform.OS === "web") {
    try {
      const s = webStorage();
      if (value === null) s?.removeItem(key);
      else s?.setItem(key, value);
    } catch { /* gizli sekme vb.: bellekte kalır */ }
    return;
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch { /* bellekte kalır */ }
}

/** Web'de büyük veriler için senkron okuma/yazma (yerel mod veritabanı). */
export function kvGetSync(key: string): string | null {
  try {
    return webStorage()?.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function kvSetSync(key: string, value: string): void {
  memory.set(key, value);
  try {
    webStorage()?.setItem(key, value);
  } catch { /* bellekte kalır */ }
}
