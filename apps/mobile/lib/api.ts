import { kvGet, kvSet } from "./kv";
import { LocalError, localRequest } from "./localServer";
import type { AllergenKey, AisleKey, CustomRecipeInput, MealSlot as Slot, Targets, CostEstimate, MealSlot, PantryItem, Profile, Recipe, UnitKey, UnitPrice } from "@menu/shared";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";
/** Sunucusuz mod: istekler telefonda karşılanır, veriler cihazda kalır (web sürümü). */
export const LOCAL_MODE = process.env.EXPO_PUBLIC_LOCAL === "1";
const TOKEN_KEY = "oturum";

let token: string | null = null;

export async function loadToken() {
  token = LOCAL_MODE ? "yerel" : await kvGet(TOKEN_KEY);
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  if (LOCAL_MODE) return;
  await kvSet(TOKEN_KEY, t);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Oturum düştüğünde uygulamanın girişe dönmesi için. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (f: () => void) => (onUnauthorized = f);

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (LOCAL_MODE) {
    try {
      return await localRequest<T>(method, path, body);
    } catch (e) {
      if (e instanceof LocalError) throw new ApiError(e.status, e.code, e.message);
      throw new ApiError(500, "internal", "Beklenmeyen bir hata oluştu.");
    }
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data?.error?.code ?? "unknown", data?.error?.message ?? "Beklenmeyen bir hata oluştu.");
  }
  return data as T;
}

export type StoredRecipe = Recipe & { id: string };

export interface PlanResponse {
  id: string;
  week_start: string;
  servings: number;
  warnings: string[];
  days: { day: number; kahvalti: StoredRecipe; ogle: StoredRecipe; aksam: StoredRecipe }[];
}

export interface ShoppingResponse {
  plan_id: string;
  groups: { aisle: AisleKey; items: { key: string; name: string; qty: number; unit: UnitKey; recipes: string[]; checked: boolean }[] }[];
  cost: CostEstimate;
  budget_try: number | null;
}

export interface LogEntry { id: string; date: string; slot: string; name: string; kcal: number; protein_g: number; karb_g: number; yag_g: number; recipe_id: string | null; portion: number }
export interface LogDay { date: string; entries: LogEntry[]; totals: { kcal: number; protein_g: number; karb_g: number; yag_g: number } }
export interface Note { id: string; text: string; updated_at: string }

export interface Me {
  email: string | null;
  has_profile: boolean;
  profile: Profile;
  targets: Targets | null;
  premium: boolean;
  usage: Record<"plan" | "tonight" | "swap", { used: number; limit: number | null }>;
}

export const api = {
  startEmail: (email: string) => req<{ dev_code?: string }>("POST", "/auth/email/start", { email }),
  verifyEmail: (email: string, code: string) => req<{ token: string }>("POST", "/auth/email/verify", { email, code }),
  apple: (identityToken: string) => req<{ token: string }>("POST", "/auth/apple", { identityToken }),
  google: (idToken: string) => req<{ token: string }>("POST", "/auth/google", { idToken }),
  logout: () => req("POST", "/auth/logout", {}),

  health: () => req<{ ok: boolean; mock: boolean; test: boolean }>("GET", "/health"),
  me: () => req<Me>("GET", "/me"),
  saveProfile: (p: Profile & { health_consent?: boolean }) => req<Profile>("PUT", "/profile", p),
  deleteHealthData: () => req("DELETE", "/health-data"),

  pantry: () => req<(PantryItem & { id: string })[]>("GET", "/pantry"),
  addPantry: (p: PantryItem) => req<PantryItem & { id: string }>("POST", "/pantry", p),
  updatePantry: (id: string, p: Partial<PantryItem>) => req("PATCH", `/pantry/${id}`, p),
  deletePantry: (id: string) => req("DELETE", `/pantry/${id}`),

  prices: () => req<UnitPrice[]>("GET", "/prices"),
  savePrice: (p: UnitPrice) => req<UnitPrice[]>("PUT", "/prices", p),
  deletePrice: (name: string) => req<UnitPrice[]>("DELETE", `/prices/${encodeURIComponent(name)}`),

  currentPlan: () => req<PlanResponse | null>("GET", "/plans/current"),
  newPlan: (fresh = false) => req<PlanResponse>("POST", "/plans", { fresh }),
  swap: (planId: string, day: number, slot: MealSlot) => req<PlanResponse>("POST", `/plans/${planId}/swap`, { day, slot }),
  tonight: (exclude: string[]) => req<StoredRecipe>("POST", "/tonight", { exclude }),

  recipe: (id: string) => req<StoredRecipe>("GET", `/recipes/${id}`),
  feedback: (id: string, vote: 1 | -1 | 0) => req("POST", `/recipes/${id}/feedback`, { vote }),

  shopping: () => req<ShoppingResponse | null>("GET", "/shopping-list"),
  check: (key: string, checked: boolean) => req<ShoppingResponse>("POST", "/shopping-list/check", { key, checked, updated_at: Date.now() }),

  logDay: (date: string) => req<LogDay>("GET", `/log/${date}`),
  logWeek: (date: string) => req<{ date: string; totals: LogDay["totals"] }[]>("GET", `/log-week/${date}`),
  addLog: (e: { date: string; slot: string; recipe_id?: string; portion?: number; name?: string; kcal?: number; protein_g?: number; karb_g?: number; yag_g?: number }) =>
    req<LogDay>("POST", "/log", e),
  deleteLog: (id: string) => req<LogDay>("DELETE", `/log/${id}`),

  water: (date: string) => req<{ date: string; ml: number; target_ml: number }>("GET", `/water/${date}`),
  addWater: (date: string, ml: number) => req<{ date: string; ml: number; target_ml: number }>("POST", "/water", { date, ml }),
  weights: () => req<{ date: string; kg: number }[]>("GET", "/weight"),
  addWeight: (date: string, kg: number) => req<{ date: string; kg: number }[]>("POST", "/weight", { date, kg }),
  deleteWeight: (date: string) => req<{ date: string; kg: number }[]>("DELETE", `/weight/${date}`),

  dietLibrary: () => req<(StoredRecipe & { slots?: Slot[] })[]>("GET", "/library/diet"),
  myRecipes: () => req<StoredRecipe[]>("GET", "/my-recipes"),
  addMyRecipe: (r: CustomRecipeInput) => req<StoredRecipe>("POST", "/my-recipes", r),
  deleteMyRecipe: (id: string) => req<StoredRecipe[]>("DELETE", `/my-recipes/${id}`),

  notes: () => req<Note[]>("GET", "/notes"),
  addNote: (text: string) => req<Note[]>("POST", "/notes", { text }),
  updateNote: (id: string, text: string) => req<Note[]>("PUT", `/notes/${id}`, { text }),
  deleteNote: (id: string) => req<Note[]>("DELETE", `/notes/${id}`),

  devPremium: (on: boolean) => req<{ premium: boolean }>("POST", "/dev/premium", { on }),
  exportData: () => req<unknown>("GET", "/account/export"),
  deleteAccount: () => req("DELETE", "/account"),
};

export type { AllergenKey };
