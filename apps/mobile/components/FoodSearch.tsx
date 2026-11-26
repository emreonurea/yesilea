import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { FOODS, foodNutrition, searchFoods, type Food } from "@menu/shared";
import { Button, Chip, colors, Muted, s } from "./ui";

const RECENT_KEY = "son_yiyecekler";
const SLOTS: [string, string][] = [["kahvalti", "Kahvaltı"], ["ogle", "Öğle"], ["aksam", "Akşam"], ["ara", "Ara öğün"]];

export interface FoodEntry { slot: string; name: string; kcal: number; protein_g: number; karb_g: number; yag_g: number }

/** Telefondaki yerel veritabanında yiyecek arar; internet ya da yapay zekâ kullanmaz. */
export function FoodSearch({ onAdd }: { onAdd: (e: FoodEntry) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [portion, setPortion] = useState(0);
  const [count, setCount] = useState(1);
  const [slot, setSlot] = useState(() => {
    const h = new Date().getHours();
    return h < 11 ? "kahvalti" : h < 16 ? "ogle" : h < 21 ? "aksam" : "ara";
  });
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(RECENT_KEY).then((v) => v && setRecent(JSON.parse(v))).catch(() => {});
  }, []);

  const results = useMemo(() => searchFoods(q, 8), [q]);
  const grams = food ? food.portions[portion].g * count : 0;
  const n = food ? foodNutrition(food, grams) : null;

  function pick(f: Food) {
    setFood(f);
    setPortion(0);
    setCount(1);
    setQ("");
  }

  async function add() {
    if (!food || !n) return;
    setBusy(true);
    try {
      const p = food.portions[portion];
      const amount = count === 1 ? p.label : `${String(count).replace(".", ",")} × ${p.label}`;
      await onAdd({ slot, name: `${food.name} (${amount})`, ...n });
      const next = [food.name, ...recent.filter((r) => r !== food.name)].slice(0, 8);
      setRecent(next);
      SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      setFood(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      {!food ? (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder="🔍 Yiyecek ara: simit, ayran, mercimek…" placeholderTextColor={colors.muted}
            style={s.input} autoCorrect={false} />
          {q ? (
            results.length ? results.map((f) => (
              <Pressable key={f.name} onPress={() => pick(f)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text }}>{f.name}</Text>
                <Muted style={{ fontSize: 12 }}>{f.portions[0].label}: {foodNutrition(f, f.portions[0].g).kcal} kcal · {f.category}</Muted>
              </Pressable>
            )) : <Muted style={{ marginTop: 8 }}>Bulunamadı. "Elle ekle" ile kendiniz girebilirsiniz.</Muted>
          ) : recent.length ? (
            <View style={{ marginTop: 10 }}>
              <Muted style={{ fontSize: 12, marginBottom: 6 }}>Son eklenenler</Muted>
              <View style={s.wrap}>
                {recent.map((name) => {
                  const f = FOODS.find((x) => x.name === name);
                  return f ? <Chip key={name} label={name} selected={false} onPress={() => pick(f)} /> : null;
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 }}>{food.name}</Text>
            <Pressable onPress={() => setFood(null)} hitSlop={8}><Text style={{ color: colors.muted }}>Vazgeç</Text></Pressable>
          </View>
          <Text style={[s.label, { marginTop: 8 }]}>Porsiyon</Text>
          <View style={s.wrap}>
            {food.portions.map((p, i) => <Chip key={p.label} label={`${p.label} (${p.g} g)`} selected={portion === i} onPress={() => setPortion(i)} />)}
          </View>
          <View style={[s.row, { marginVertical: 6 }]}>
            <Text style={[s.label, { marginBottom: 0, marginRight: 12 }]}>Adet</Text>
            <Pressable onPress={() => setCount(Math.max(0.5, count - 0.5))} hitSlop={8}><Text style={{ fontSize: 24, color: colors.primary, paddingHorizontal: 12 }}>−</Text></Pressable>
            <Text style={{ fontSize: 17, color: colors.text, minWidth: 36, textAlign: "center" }}>{String(count).replace(".", ",")}</Text>
            <Pressable onPress={() => setCount(Math.min(20, count + 0.5))} hitSlop={8}><Text style={{ fontSize: 24, color: colors.primary, paddingHorizontal: 12 }}>+</Text></Pressable>
          </View>
          <View style={s.wrap}>
            {SLOTS.map(([k, l]) => <Chip key={k} label={l} selected={slot === k} onPress={() => setSlot(k)} />)}
          </View>
          {n ? (
            <Text style={{ color: colors.text, marginVertical: 6 }}>
              <Text style={{ fontWeight: "800", color: colors.primary }}>{n.kcal} kcal</Text> · P {n.protein_g} g · K {n.karb_g} g · Y {n.yag_g} g
            </Text>
          ) : null}
          <Button title="Ekle" onPress={add} loading={busy} />
          <Muted style={{ fontSize: 11 }}>Değerler yaklaşıktır, tarife ve markaya göre değişir.</Muted>
        </View>
      )}
    </View>
  );
}
