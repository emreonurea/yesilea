import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ALLERGEN_LABELS, DISCLAIMER_DIET, formatQty, scaleQty } from "@menu/shared";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLoad } from "../../lib/useLoad";
import { NutritionBars } from "../../components/NutritionBars";
import { Card, colors, Disclaimer, ErrorText, Loading, Muted, s, Screen, Title } from "../../components/ui";
import { HalalBadge } from "../../components/RecipeCard";
import { Button } from "../../components/ui";
import { ApiError } from "../../lib/api";

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { data: r, error, setError } = useLoad(() => api.recipe(id));
  const [servings, setServings] = useState<number | null>(null);
  const [vote, setVote] = useState<1 | -1 | 0>(0);
  const [ate, setAte] = useState<string | null>(null);
  const [needPremium, setNeedPremium] = useState(false);

  if (!r) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const n = servings ?? r.servings;

  async function eat(portion: number) {
    setError(null);
    const d = new Date();
    const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const h = d.getHours();
    const slot = h < 11 ? "kahvalti" : h < 16 ? "ogle" : h < 21 ? "aksam" : "ara";
    try {
      const day = await api.addLog({ date, slot, recipe_id: id, portion });
      setAte(`Eklendi. Bugün toplam ${day.totals.kcal} kcal.`);
    } catch (e) {
      setError((e as Error).message);
      setNeedPremium(e instanceof ApiError && e.code === "premium");
    }
  }

  async function sendVote(v: 1 | -1) {
    const next = vote === v ? 0 : v;
    setVote(next);
    try { await api.feedback(id, next); } catch (e) { setError((e as Error).message); }
  }

  return (
    <Screen>
      <Title>{r.name_tr}</Title>
      {r.name_local && r.name_local !== r.name_tr ? <Muted>{r.name_local}</Muted> : null}
      <Muted style={{ marginTop: 4 }}>{r.description}</Muted>
      <Muted style={{ marginTop: 8 }}>Hazırlık {r.prep_min} dk · Pişirme {r.cook_min} dk · {r.difficulty}</Muted>
      <HalalBadge status={r.halal_status} />

      <Card style={{ marginTop: 12 }}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 8 }]}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>Malzemeler</Text>
          <View style={s.row}>
            <Pressable onPress={() => setServings(Math.max(1, n - 1))} hitSlop={8} accessibilityLabel="Porsiyonu azalt"><Text style={{ fontSize: 22, color: colors.primary, paddingHorizontal: 10 }}>−</Text></Pressable>
            <Text style={{ fontSize: 15, color: colors.text }}>{n} kişilik</Text>
            <Pressable onPress={() => setServings(Math.min(20, n + 1))} hitSlop={8} accessibilityLabel="Porsiyonu artır"><Text style={{ fontSize: 22, color: colors.primary, paddingHorizontal: 10 }}>+</Text></Pressable>
          </View>
        </View>
        {r.ingredients.map((i, idx) => (
          <Text key={idx} style={{ fontSize: 15, color: colors.text, paddingVertical: 3 }}>
            • {formatQty(scaleQty(i.qty, r.servings, n), i.unit)} {i.name}{i.note ? ` (${i.note})` : ""}
          </Text>
        ))}
      </Card>

      {r.nutrition ? (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 }}>Besin değeri (1 porsiyon, tahmini)</Text>
          <NutritionBars n={r.nutrition} />
          <Muted style={{ fontSize: 12 }}>{DISCLAIMER_DIET}</Muted>
        </Card>
      ) : null}

      {r.nutrition ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Bunu yediniz mi?</Text>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 6 }}><Button title="Yedim (1 porsiyon)" onPress={() => eat(1)} /></View>
            <View style={{ width: 110 }}><Button title="½ porsiyon" kind="secondary" onPress={() => eat(0.5)} /></View>
          </View>
          {ate ? <Text style={{ color: colors.ok, marginTop: 4 }}>{ate}</Text> : null}
          {needPremium ? <Button title="Kalori takibi için Premium" kind="secondary" onPress={() => router.push("/premium")} /> : null}
        </Card>
      ) : null}

      {r.substitutes?.length ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4 }}>Bulamazsanız</Text>
          {r.substitutes.map((x, i) => <Muted key={i}>{x.for} yerine: {x.use}</Muted>)}
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 }}>Yapılışı</Text>
        {r.steps.map((st, i) => (
          <Text key={i} style={{ fontSize: 15, color: colors.text, marginBottom: 8 }}>{i + 1}. {st}</Text>
        ))}
      </Card>

      {r.allergens.length ? <Muted>Alerjenler: {r.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}</Muted> : <Muted>Bilinen alerjen etiketi yok.</Muted>}

      <View style={[s.row, { marginTop: 16, justifyContent: "center" }]}>
        <Pressable onPress={() => sendVote(1)} style={[s.chip, vote === 1 && { backgroundColor: colors.primarySoft }]}><Text>👍 Beğendim</Text></Pressable>
        <Pressable onPress={() => sendVote(-1)} style={[s.chip, vote === -1 && { backgroundColor: colors.primarySoft }]}><Text>👎 Bir daha önerme</Text></Pressable>
      </View>
      <ErrorText error={error} />
      <Disclaimer halal={me?.profile.halal_sensitive} />
    </Screen>
  );
}
