import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Link } from "expo-router";
import { ALLERGEN_KEYS, ALLERGEN_LABELS, DISCLAIMER_RELIGIOUS, type AllergenKey, type Diet, type Profile } from "@menu/shared";
import { api } from "../lib/api";
import { Button, Card, Chip, colors, ErrorText, Field, Muted, s } from "./ui";

const DIETS: { key: Diet; label: string }[] = [
  { key: "hepsi", label: "Kısıt yok" },
  { key: "vejetaryen", label: "Vejetaryen" },
  { key: "vegan", label: "Vegan" },
];

export function ProfileForm({ initial, onSaved, submitLabel = "Kaydet" }: { initial: Profile; onSaved: () => void; submitLabel?: string }) {
  const [household, setHousehold] = useState(String(initial.household_size));
  const [budget, setBudget] = useState(initial.weekly_budget_try ? String(initial.weekly_budget_try) : "");
  const [diet, setDiet] = useState<Diet>(initial.diet);
  const [allergies, setAllergies] = useState<AllergenKey[]>(initial.allergies);
  const [dislikes, setDislikes] = useState(initial.dislikes.join(", "));
  const [maxMin, setMaxMin] = useState(initial.max_weekday_minutes ? String(initial.max_weekday_minutes) : "");
  const [halal, setHalal] = useState(initial.halal_sensitive);
  const [consent, setConsent] = useState(!!initial.health_consent_at);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (a: AllergenKey) => setAllergies((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.saveProfile({
        household_size: Number(household),
        weekly_budget_try: budget ? Number(budget.replace(",", ".")) : null,
        diet,
        allergies,
        dislikes: dislikes.split(",").map((x) => x.trim()).filter(Boolean),
        max_weekday_minutes: maxMin ? Number(maxMin) : null,
        halal_sensitive: halal,
        body: initial.body,
        health_consent_at: initial.health_consent_at,
        health_consent: consent,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Field label="Hanede kaç kişi var?" keyboardType="number-pad" value={household} onChangeText={setHousehold} />
      <Field label="Haftalık market bütçesi (TL, isteğe bağlı)" keyboardType="decimal-pad" value={budget} onChangeText={setBudget} placeholder="ör. 2500" />

      <Text style={s.label}>Diyet</Text>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {DIETS.map((d) => <Chip key={d.key} label={d.label} selected={diet === d.key} onPress={() => setDiet(d.key)} />)}
      </View>

      <Text style={s.label}>Alerjiler</Text>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {ALLERGEN_KEYS.map((a) => <Chip key={a} label={ALLERGEN_LABELS[a]} selected={allergies.includes(a)} onPress={() => toggle(a)} />)}
      </View>

      {allergies.length && !initial.health_consent_at ? (
        <Card style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
            <Text style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 13 }}>Alerji ve vücut bilgilerim (boy, kilo, yaş), yemek, su ve kilo kayıtlarım gibi sağlık verilerimin bana menü, tarif ve beslenme önerisi sunulması amacıyla işlenmesine ve menü hazırlanırken alerji bilgilerimin yurt dışındaki yapay zekâ hizmet sağlayıcısına (Anthropic, ABD) aktarılmasına açık rıza veriyorum. Rızamı Ayarlar'dan istediğim zaman geri alabilirim. <Link href="/privacy" style={{ color: colors.primary, textDecorationLine: "underline" }}>Gizlilik politikasını oku</Link></Text>
          </View>
        </Card>
      ) : null}

      <Field label="Sevmediğiniz yiyecekler (virgülle ayırın)" value={dislikes} onChangeText={setDislikes} placeholder="ör. patlıcan, bamya" />
      <Field label="Hafta içi en fazla kaç dakika? (isteğe bağlı)" keyboardType="number-pad" value={maxMin} onChangeText={setMaxMin} placeholder="ör. 30" />

      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>Helal hassasiyeti</Text>
          <Switch value={halal} onValueChange={setHalal} trackColor={{ true: colors.primary }} />
        </View>
        <Muted style={{ marginTop: 6 }}>Açıkken domuz ürünleri ve alkol içeren tarifler önerilmez.</Muted>
        <Muted style={{ marginTop: 6, fontSize: 12 }}>{DISCLAIMER_RELIGIOUS}</Muted>
      </Card>

      <ErrorText error={error} />
      <Button title={submitLabel} onPress={save} loading={saving} disabled={allergies.length > 0 && !consent} />
    </View>
  );
}
