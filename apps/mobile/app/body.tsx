import { useEffect, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { Switch, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ACTIVITY_LABELS, computeTargets, DISCLAIMER_DIET, GOAL_LABELS, validateBody,
  type Activity, type Goal, type Sex,
} from "@menu/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PremiumLock } from "../components/PremiumLock";
import { Button, Card, Chip, colors, ErrorText, Field, Loading, Muted, s, Screen } from "../components/ui";

export default function Body() {
  const { me, refresh } = useAuth();
  const b = me?.profile.body;
  const [sex, setSex] = useState<Sex | null>(b?.sex ?? null);
  const [age, setAge] = useState(b ? String(b.age) : "");
  const [height, setHeight] = useState(b ? String(b.height_cm) : "");
  const [weight, setWeight] = useState(b ? String(b.weight_kg) : "");
  const [activity, setActivity] = useState<Activity>(b?.activity ?? "az");
  const [goal, setGoal] = useState<Goal>(b?.goal ?? "koru");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(!!me?.profile.health_consent_at);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [newKg, setNewKg] = useState("");
  useEffect(() => { api.weights().then(setWeights).catch(() => {}); }, []);
  const todayStr = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  async function addWeight() {
    setError(null);
    try {
      setWeights(await api.addWeight(todayStr, Number(newKg.replace(",", "."))));
      setNewKg("");
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }

  const body = useMemo(() => validateBody({
    sex, age: Number(age), height_cm: Number(height.replace(",", ".")), weight_kg: Number(weight.replace(",", ".")), activity, goal,
  }), [sex, age, height, weight, activity, goal]);
  const targets = typeof body === "object" ? computeTargets(body) : null;

  if (!me) return <Loading />;
  if (!me.premium) {
    return (
      <Screen>
        <PremiumLock title="Diyet programı Premium'a özel" text="Boy, kilo ve hedefinize göre günlük kalori, makro ve mikro besin hedefleri hesaplanır; menüler bu hedeflere göre hazırlanır." />
      </Screen>
    );
  }

  async function save(enable: boolean) {
    setError(null);
    if (enable && typeof body === "string") { setError(body); return; }
    setBusy(true);
    try {
      await api.saveProfile({ ...me!.profile, body: enable && typeof body === "object" ? body : null, health_consent: consent });
      await refresh();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>Bilgilerinize göre günlük kalori, makro ve mikro besin hedeflerinizi hesaplıyoruz. Menüler bu hedeflere göre hazırlanır.</Muted>

      <Text style={s.label}>Cinsiyet</Text>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        <Chip label="Kadın" selected={sex === "kadin"} onPress={() => setSex("kadin")} />
        <Chip label="Erkek" selected={sex === "erkek"} onPress={() => setSex("erkek")} />
      </View>
      <View style={s.row}>
        <View style={{ flex: 1, marginRight: 8 }}><Field label="Yaş" keyboardType="number-pad" value={age} onChangeText={setAge} /></View>
        <View style={{ flex: 1, marginRight: 8 }}><Field label="Boy (cm)" keyboardType="number-pad" value={height} onChangeText={setHeight} /></View>
        <View style={{ flex: 1 }}><Field label="Kilo (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>
      </View>

      <Text style={s.label}>Hareket düzeyi</Text>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => <Chip key={a} label={ACTIVITY_LABELS[a]} selected={activity === a} onPress={() => setActivity(a)} />)}
      </View>

      <Text style={s.label}>Hedef</Text>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => <Chip key={g} label={GOAL_LABELS[g]} selected={goal === g} onPress={() => setGoal(g)} />)}
      </View>

      {targets ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Günlük hedefiniz</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary, marginVertical: 4 }}>{targets.kcal} kcal</Text>
          <Muted>Protein {targets.protein_g} g · Karbonhidrat {targets.karb_g} g · Yağ {targets.yag_g} g</Muted>
          <Muted style={{ marginTop: 4 }}>Vücut kitle indeksi: {targets.bmi} ({targets.bmi_label}) · Bazal metabolizma: {targets.bmr} kcal</Muted>
          {targets.notes.map((n) => <Muted key={n} style={{ marginTop: 6, fontSize: 12 }}>• {n}</Muted>)}
        </Card>
      ) : null}

      {b ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>⚖️ Kilo takibi</Text>
          <View style={[s.row, { marginTop: 8 }]}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label="Bugünkü kilonuz (kg)" keyboardType="decimal-pad" value={newKg} onChangeText={setNewKg} /></View>
            <View style={{ width: 110 }}><Button title="Kaydet" onPress={addWeight} disabled={!newKg} /></View>
          </View>
          {weights.length >= 2 ? (() => {
            const pts = [...weights].reverse().slice(-14);
            const min = Math.min(...pts.map((p) => p.kg)) - 0.5;
            const max = Math.max(...pts.map((p) => p.kg)) + 0.5;
            const diff = Math.round((weights[0].kg - weights[weights.length - 1].kg) * 10) / 10;
            return (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, marginVertical: 8 }}>
                  {pts.map((p) => (
                    <View key={p.date} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{ width: 10, height: 10 + ((p.kg - min) / (max - min)) * 70, backgroundColor: colors.primary, borderRadius: 5 }} />
                    </View>
                  ))}
                </View>
                <Muted>İlk kayda göre: {diff > 0 ? "+" : ""}{String(diff).replace(".", ",")} kg</Muted>
              </>
            );
          })() : null}
          {weights.slice(0, 5).map((w) => (
            <View key={w.date} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Muted>{new Date(w.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</Muted>
              <View style={s.row}>
                <Text style={{ color: colors.text, marginRight: 12 }}>{String(w.kg).replace(".", ",")} kg</Text>
                <Pressable onPress={async () => setWeights(await api.deleteWeight(w.date))} hitSlop={8}><Text style={{ color: colors.danger }}>Sil</Text></Pressable>
              </View>
            </View>
          ))}
          <Muted style={{ fontSize: 12, marginTop: 4 }}>Son kaydettiğiniz kilo, hedef hesaplarına kendiliğinden yansır.</Muted>
        </Card>
      ) : null}

      {!me.profile.health_consent_at ? (
        <Card style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
            <Text style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 13 }}>Alerji ve vücut bilgilerim (boy, kilo, yaş), yemek, su ve kilo kayıtlarım gibi sağlık verilerimin bana menü, tarif ve beslenme önerisi sunulması amacıyla işlenmesine ve menü hazırlanırken alerji bilgilerimin yurt dışındaki yapay zekâ hizmet sağlayıcısına (Anthropic, ABD) aktarılmasına açık rıza veriyorum. Rızamı Ayarlar'dan istediğim zaman geri alabilirim.</Text>
          </View>
        </Card>
      ) : null}

      <ErrorText error={error} />
      <Button title={b ? "Güncelle" : "Diyet programını başlat"} onPress={() => save(true)} loading={busy} disabled={!consent} />
      {b ? <Button title="Diyet programını kapat" kind="secondary" onPress={() => save(false)} /> : null}
      <Muted style={{ fontSize: 12, marginTop: 12 }}>{DISCLAIMER_DIET}</Muted>
    </Screen>
  );
}
