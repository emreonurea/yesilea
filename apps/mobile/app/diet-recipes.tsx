import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { MEAL_SLOT_LABELS, type MealSlot } from "@menu/shared";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { Card, Chip, colors, Disclaimer, ErrorText, Loading, Muted, s, Screen } from "../components/ui";
import { MacroLine } from "../components/NutritionBars";
import { useAuth } from "../lib/auth";

type Filter = "hepsi" | "dusuk" | "protein" | "vejetaryen" | MealSlot;
const FILTERS: [Filter, string][] = [
  ["hepsi", "Tümü"], ["dusuk", "300 kcal altı"], ["protein", "Yüksek protein"], ["vejetaryen", "Vejetaryen"],
  ["kahvalti", MEAL_SLOT_LABELS.kahvalti], ["ogle", MEAL_SLOT_LABELS.ogle], ["aksam", MEAL_SLOT_LABELS.aksam],
];

export default function DietRecipes() {
  const { me } = useAuth();
  const { data, error, loading } = useLoad(api.dietLibrary);
  const [filter, setFilter] = useState<Filter>("hepsi");

  if (loading && !data) return <Loading />;
  const list = (data ?? []).filter((r) => {
    const n = r.nutrition;
    if (filter === "dusuk") return !!n && n.kcal < 300;
    if (filter === "protein") return !!n && (n.protein_g * 4) / n.kcal >= 0.3;
    if (filter === "vejetaryen") return r.diet_tags.includes("vejetaryen");
    if (filter === "hepsi") return true;
    return (r.slots ?? []).includes(filter);
  });

  return (
    <Screen>
      <Muted style={{ marginBottom: 8 }}>Az yağlı, sebze ve protein ağırlıklı tarifler. Tarifi açıp "Yedim" diyerek kalori takibinize ekleyebilirsiniz.</Muted>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {FILTERS.map(([k, l]) => <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />)}
      </View>
      <ErrorText error={error} />
      {list.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }} onPress={() => router.push(`/recipe/${r.id}`)}>{r.name_tr}</Text>
          <Muted style={{ marginVertical: 2 }}>{r.description}</Muted>
          {r.nutrition ? <MacroLine n={r.nutrition} /> : null}
          <Text style={{ color: colors.primary, marginTop: 6 }} onPress={() => router.push(`/recipe/${r.id}`)}>Tarifi aç →</Text>
        </Card>
      ))}
      {!list.length ? <Muted>Bu filtreye uyan tarif yok.</Muted> : null}
      <Disclaimer halal={me?.profile.halal_sensitive} />
    </Screen>
  );
}
