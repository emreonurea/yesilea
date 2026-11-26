import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { colors } from "../components/ui";

export interface Theme {
  key: string;
  label: string;
  primary: string;
  primarySoft: string;
  bg: string;
}

export const THEMES: Theme[] = [
  { key: "yesil", label: "Yeşil", primary: "#15803D", primarySoft: "#DCFCE7", bg: "#F6FBF7" },
  { key: "zumrut", label: "Zümrüt", primary: "#047857", primarySoft: "#D1FAE5", bg: "#F4FBF8" },
  { key: "turuncu", label: "Turuncu", primary: "#C2410C", primarySoft: "#FDEBDD", bg: "#FBF8F3" },
  { key: "mavi", label: "Mavi", primary: "#1D4ED8", primarySoft: "#DBEAFE", bg: "#F6F8FC" },
  { key: "mor", label: "Mor", primary: "#7E22CE", primarySoft: "#F3E8FF", bg: "#FAF7FD" },
  { key: "pembe", label: "Pembe", primary: "#BE185D", primarySoft: "#FCE7F3", bg: "#FDF7FA" },
];

const KEY = "tema";

function apply(t: Theme) {
  colors.primary = t.primary;
  colors.primarySoft = t.primarySoft;
  colors.bg = t.bg;
}

const Ctx = createContext<{ theme: Theme; setTheme: (k: string) => void }>({ theme: THEMES[0], setTheme: () => {} });

/** Renk temasını yükler; tema değişince tüm ekranlar yeni renklerle yeniden çizilir. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    apply(THEMES[0]);
    return THEMES[0];
  });

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((k) => {
      const t = THEMES.find((x) => x.key === k);
      if (t) { apply(t); setThemeState(t); }
    }).catch(() => {});
  }, []);

  const setTheme = (k: string) => {
    const t = THEMES.find((x) => x.key === k) ?? THEMES[0];
    apply(t);
    setThemeState(t);
    SecureStore.setItemAsync(KEY, t.key).catch(() => {});
  };

  // Anahtar değişince alt ağaç yeniden oluşur ve yeni renklerle çizilir.
  return <Ctx.Provider value={{ theme, setTheme }}><Fragment key={theme.key}>{children}</Fragment></Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
