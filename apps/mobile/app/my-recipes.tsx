import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { buildCustomRecipe, foodNutrition, FOODS, searchFoods, type CustomItem } from "@menu/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLoad } from "../lib/useLoad";
import { Button, Card, colors, ErrorText, Field, Loading, Muted, s, Screen } from "../components/ui";
import { MacroLine } from "../components/NutritionBars";
import { PremiumLock } from "../components/PremiumLock";

const num = (v: string) => Number(v.replace(",", ".")) || 0;

function itemLabel(it: CustomItem) {
  if ("food" in it) {
    const f = FOODS.find((x) => x.name === it.food);
    return `${it.food} · ${it.grams} g · ${f ? foodNutrition(f, it.grams).kcal : "?"} kcal`;
  }
  return `${it.name} · ${it.kcal} kcal (elle)`;
}

function NewRecipe({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState(2);
  const [items, setItems] = useState<CustomItem[]>([]);
  const [steps, setSteps] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [grams, setGrams] = useState("");
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ name: "", kcal: "", protein_g: "", karb_g: "", yag_g: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => searchFoods(q, 6), [q]);
  const preview = useMemo(() => buildCustomRecipe({ name: name || "Önizleme", servings, items, steps: steps.split("\n") }), [name, servings, items, steps]);

  function addFood() {
    if (!picked || !num(grams)) return;
    setItems([...items, { food: picked, grams: num(grams) }]);
    setPicked(null); setGrams(""); setQ("");
  }
  function addManual() {
    if (!m.name.trim()) return;
    setItems([...items, { name: m.name.trim(), kcal: num(m.kcal), protein_g: num(m.protein_g), karb_g: num(m.karb_g), yag_g: num(m.yag_g) }]);
    setM({ name: "", kcal: "", protein_g: "", karb_g: "", yag_g: "" }); setManual(false);
  }
  async function save() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.addMyRecipe({ name, servings, items, steps: steps.split("\n") });
      onSaved();
      router.push(`/recipe/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 }}>Yeni yemek</Text>
      <Field label="Yemeğin adı" value={name} onChangeText={setName} placeholder="ör. Annemin mercimek köftesi" />
      <View style={[s.row, { marginBottom: 10 }]}>
        <Text style={[s.label, { marginBottom: 0, marginRight: 12 }]}>Kaç porsiyon çıkıyor?</Text>
        <Pressable onPress={() => setServings(Math.max(1, servings - 1))} hitSlop={8}><Text style={{ fontSize: 24, color: colors.primary, paddingHorizontal: 12 }}>−</Text></Pressable>
        <Text style={{ fontSize: 17, color: colors.text }}>{servings}</Text>
        <Pressable onPress={() => setServings(Math.min(20, servings + 1))} hitSlop={8}><Text style={{ fontSize: 24, color: colors.primary, paddingHorizontal: 12 }}>+</Text></Pressable>
      </View>

      <Text style={s.label}>Malzemeler</Text>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ flex: 1, color: colors.text }}>{itemLabel(it)}</Text>
          <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))} hitSlop={8}><Text style={{ color: colors.danger }}>Çıkar</Text></Pressable>
        </View>
      ))}

      {!picked ? (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder="🔍 Malzeme ara: bulgur, kıyma, zeytinyağı…" placeholderTextColor={colors.muted} style={[s.input, { marginTop: 8 }]} />
          {results.map((f) => (
            <Pressable key={f.name} onPress={() => { setPicked(f.name); setGrams(String(f.portions[0].g)); }} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.text }}>{f.name} <Text style={{ color: colors.muted, fontSize: 12 }}>· 100 g: {f.kcal} kcal</Text></Text>
            </Pressable>
          ))}
        </>
      ) : (
        <View style={[s.row, { marginTop: 8 }]}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label={`${picked} (gram)`} keyboardType="decimal-pad" value={grams} onChangeText={setGrams} /></View>
          <View style={{ width: 80 }}><Button title="Ekle" onPress={addFood} disabled={!num(grams)} /></View>
          <Pressable onPress={() => setPicked(null)} hitSlop={8} style={{ marginLeft: 8 }}><Text style={{ color: colors.muted }}>✕</Text></Pressable>
        </View>
      )}

      <Pressable onPress={() => setManual(!manual)}><Text style={{ color: colors.primary, marginVertical: 8 }}>{manual ? "Elle eklemeyi kapat" : "Listede yok mu? Elle ekle"}</Text></Pressable>
      {manual ? (
        <View>
          <Field label="Malzeme" value={m.name} onChangeText={(v: string) => setM({ ...m, name: v })} />
          <View style={s.row}>
            {(["kcal", "protein_g", "karb_g", "yag_g"] as const).map((k, i) => (
              <View key={k} style={{ flex: 1, marginRight: i < 3 ? 6 : 0 }}>
                <Field label={{ kcal: "kcal", protein_g: "Protein", karb_g: "Karb.", yag_g: "Yağ" }[k]} keyboardType="decimal-pad" value={m[k]} onChangeText={(v: string) => setM({ ...m, [k]: v })} />
              </View>
            ))}
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 6 }}>Kullandığınız miktarın toplam değerlerini yazın (paketin üstünden bakabilirsiniz).</Muted>
          <Button title="Malzemeyi ekle" kind="secondary" onPress={addManual} disabled={!m.name.trim()} />
        </View>
      ) : null}

      <Field label="Yapılışı (isteğe bağlı, her adımı yeni satıra yazın)" value={steps} onChangeText={setSteps} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />

      {typeof preview === "object" && items.length ? (
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, padding: 10, marginVertical: 6 }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>1 porsiyon (tahmini)</Text>
          <MacroLine n={preview.nutrition!} />
        </View>
      ) : null}
      <ErrorText error={error} />
      <Button title="Yemeği kaydet" onPress={save} loading={busy} disabled={!name.trim() || !items.length} />
    </Card>
  );
}

export default function MyRecipes() {
  const { me } = useAuth();
  const { data, setData, error, setError, loading, reload } = useLoad(api.myRecipes);
  const [creating, setCreating] = useState(false);

  if (!me) return <Loading />;
  if (!me.premium) {
    return (
      <Screen>
        <PremiumLock title="Yemeklerim Premium'a özel" text="Kendi yemeğinizi malzemeleri ve gramajlarıyla kaydedin; porsiyon başına kalori ve makrolar otomatik hesaplansın, tek dokunuşla takibe ekleyin." />
      </Screen>
    );
  }
  if (loading && !data) return <Loading />;

  const remove = (id: string, name: string) =>
    Alert.alert("Yemeği sil", `"${name}" silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { try { setData(await api.deleteMyRecipe(id)); } catch (e) { setError((e as Error).message); } } },
    ]);

  return (
    <Screen>
      {creating ? <NewRecipe onSaved={() => { setCreating(false); reload(); }} /> : <Button title="+ Yeni yemek oluştur" onPress={() => setCreating(true)} />}
      {creating ? <Button title="Vazgeç" kind="secondary" onPress={() => setCreating(false)} /> : null}
      <ErrorText error={error} />
      {data && !data.length && !creating ? (
        <Muted style={{ marginTop: 8 }}>Henüz kendi yemeğiniz yok. Evde sık yaptığınız bir yemeği ekleyin, kalorisini bir kez hesaplayalım; sonra tek dokunuşla takibe eklersiniz.</Muted>
      ) : null}
      {data?.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }} onPress={() => router.push(`/recipe/${r.id}`)}>{r.name_tr}</Text>
          <Muted style={{ fontSize: 12 }}>{r.servings} porsiyon · {r.ingredients.length} malzeme</Muted>
          {r.nutrition ? <MacroLine n={r.nutrition} /> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: colors.primary }} onPress={() => router.push(`/recipe/${r.id}`)}>Aç / Yedim →</Text>
            <Text style={{ color: colors.danger }} onPress={() => remove(r.id, r.name_tr)}>Sil</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
