import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MEAL_SLOT_LABELS, MEAL_SLOTS, type Targets } from "@menu/shared";
import { api, type LogDay, type PlanResponse } from "../lib/api";
import { Button, Card, Chip, colors, ErrorText, Field, Muted, s } from "./ui";
import { FoodSearch } from "./FoodSearch";

const localDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const SLOT_LABEL: Record<string, string> = { ...MEAL_SLOT_LABELS, ara: "Ara öğün" };
const DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function Remaining({ label, eaten, target, unit }: { label: string; eaten: number; target?: number; unit: string }) {
  const pct = target ? Math.min(1, eaten / target) : 0;
  const left = target != null ? Math.round(target - eaten) : null;
  return (
    <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{Math.round(eaten)}{unit}</Text>
      {target ? (
        <>
          <View style={{ height: 5, width: "100%", backgroundColor: "#E5E7EB", borderRadius: 3, marginTop: 4 }}>
            <View style={{ height: 5, width: `${pct * 100}%`, backgroundColor: eaten > target * 1.1 ? colors.danger : colors.primary, borderRadius: 3 }} />
          </View>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{left! >= 0 ? `${left}${unit} kaldı` : `${-left!}${unit} fazla`}</Text>
        </>
      ) : null}
    </View>
  );
}

/** Günlük kalori ve makro takibi: ne yedim? */
export function Tracker({ targets, plan }: { targets: Targets | null; plan: PlanResponse | null | undefined }) {
  const today = localDate();
  const [log, setLog] = useState<LogDay | null>(null);
  const [week, setWeek] = useState<{ date: string; totals: LogDay["totals"] }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [water, setWater] = useState<{ ml: number; target_ml: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", kcal: "", protein_g: "", karb_g: "", yag_g: "", slot: "ara" });

  const load = useCallback(async () => {
    try {
      const [d, w, wa] = await Promise.all([api.logDay(today), api.logWeek(today), api.water(today)]);
      setLog(d); setWeek(w); setWater(wa);
    } catch (e) { setError((e as Error).message); }
  }, [today]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function run(p: Promise<LogDay>) {
    setError(null);
    try { setLog(await p); setWeek(await api.logWeek(today)); } catch (e) { setError((e as Error).message); }
  }

  const dayIdx = ((new Date().getDay() + 6) % 7) + 1;
  const todayPlan = plan?.days.find((d) => d.day === dayIdx);
  const eatenIds = new Set((log?.entries ?? []).map((e) => e.recipe_id).filter(Boolean));
  const t = log?.totals ?? { kcal: 0, protein_g: 0, karb_g: 0, yag_g: 0 };
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const maxWeek = Math.max(targets?.kcal ?? 0, ...week.map((w) => w.totals.kcal), 1);

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>Bugün ne yedim?</Text>
        <Text style={{ fontSize: 30, fontWeight: "800", color: colors.primary, marginTop: 4 }}>
          {t.kcal}<Text style={{ fontSize: 16, color: colors.muted }}>{targets ? ` / ${targets.kcal} kcal` : " kcal"}</Text>
        </Text>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          <Remaining label="Protein" eaten={t.protein_g} target={targets?.protein_g} unit="g" />
          <Remaining label="Karbonhidrat" eaten={t.karb_g} target={targets?.karb_g} unit="g" />
          <Remaining label="Yağ" eaten={t.yag_g} target={targets?.yag_g} unit="g" />
        </View>
        {!targets ? <Muted style={{ fontSize: 12, marginTop: 8 }}>Hedef görmek için Diyet programım'dan bilgilerinizi girin.</Muted> : null}
      </Card>

      <Card>
        <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 8 }}>Yiyecek ekle</Text>
        <FoodSearch onAdd={(e) => run(api.addLog({ date: today, ...e }))} />
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={{ flex: 1, marginRight: 6 }}><Button title="🍳 Yemeklerim" kind="secondary" onPress={() => router.push("/my-recipes")} /></View>
          <View style={{ flex: 1 }}><Button title="🥦 Diyet yemekleri" kind="secondary" onPress={() => router.push("/diet-recipes")} /></View>
        </View>
      </Card>

      {water ? (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "700", color: colors.text }}>💧 Su</Text>
            <Text style={{ color: colors.muted }}>{(water.ml / 1000).toLocaleString("tr-TR")} / {(water.target_ml / 1000).toLocaleString("tr-TR")} L</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 8 }}>
            {Array.from({ length: Math.ceil(water.target_ml / 250) }, (_, i) => (
              <Text key={i} style={{ fontSize: 22, opacity: i < Math.floor(water.ml / 250) ? 1 : 0.25, marginRight: 2 }}>🥛</Text>
            ))}
          </View>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 6 }}><Button title="+ 1 bardak (250 ml)" onPress={async () => setWater(await api.addWater(today, 250))} /></View>
            <View style={{ width: 90 }}><Button title="Geri al" kind="secondary" onPress={async () => setWater(await api.addWater(today, -250))} /></View>
          </View>
        </Card>
      ) : null}

      {todayPlan ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6 }}>Bugünün menüsünden ekle</Text>
          {MEAL_SLOTS.map((sl) => {
            const r = todayPlan[sl];
            const done = eatenIds.has(r.id);
            return (
              <View key={sl} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Muted style={{ fontSize: 12 }}>{MEAL_SLOT_LABELS[sl]}</Muted>
                  <Text style={{ color: colors.text }}>{r.name_tr}</Text>
                  {r.nutrition ? <Muted style={{ fontSize: 12 }}>{r.nutrition.kcal} kcal</Muted> : null}
                </View>
                <Pressable disabled={done || !r.nutrition} onPress={() => run(api.addLog({ date: today, slot: sl, recipe_id: r.id }))}
                  style={{ backgroundColor: done ? colors.primarySoft : colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: done ? colors.primary : "#fff", fontWeight: "600" }}>{done ? "Yendi ✓" : "Yedim"}</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>Kayıtlar</Text>
          <Pressable onPress={() => setAdding(!adding)}><Text style={{ color: colors.primary, fontWeight: "600" }}>{adding ? "Kapat" : "+ Elle ekle"}</Text></Pressable>
        </View>
        {adding ? (
          <View style={{ marginTop: 10 }}>
            <Field label="Yiyecek" value={f.name} onChangeText={(v: string) => setF({ ...f, name: v })} placeholder="ör. 1 kase yoğurt" />
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 6 }}><Field label="kcal" keyboardType="decimal-pad" value={f.kcal} onChangeText={(v: string) => setF({ ...f, kcal: v })} /></View>
              <View style={{ flex: 1, marginRight: 6 }}><Field label="Protein g" keyboardType="decimal-pad" value={f.protein_g} onChangeText={(v: string) => setF({ ...f, protein_g: v })} /></View>
              <View style={{ flex: 1, marginRight: 6 }}><Field label="Karb. g" keyboardType="decimal-pad" value={f.karb_g} onChangeText={(v: string) => setF({ ...f, karb_g: v })} /></View>
              <View style={{ flex: 1 }}><Field label="Yağ g" keyboardType="decimal-pad" value={f.yag_g} onChangeText={(v: string) => setF({ ...f, yag_g: v })} /></View>
            </View>
            <View style={s.wrap}>
              {["kahvalti", "ogle", "aksam", "ara"].map((k) => <Chip key={k} label={SLOT_LABEL[k]} selected={f.slot === k} onPress={() => setF({ ...f, slot: k })} />)}
            </View>
            <Button title="Ekle" disabled={!f.name.trim() || !num(f.kcal)} onPress={async () => {
              await run(api.addLog({ date: today, slot: f.slot, name: f.name, kcal: num(f.kcal), protein_g: num(f.protein_g), karb_g: num(f.karb_g), yag_g: num(f.yag_g) }));
              setF({ name: "", kcal: "", protein_g: "", karb_g: "", yag_g: "", slot: f.slot });
              setAdding(false);
            }} />
          </View>
        ) : null}
        {log && !log.entries.length ? <Muted style={{ marginTop: 6 }}>Bugün henüz kayıt yok.</Muted> : null}
        {log?.entries.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }}>{e.name}{e.portion !== 1 ? ` (${e.portion} porsiyon)` : ""}</Text>
              <Muted style={{ fontSize: 12 }}>{SLOT_LABEL[e.slot]} · {Math.round(e.kcal)} kcal · P {Math.round(e.protein_g)} · K {Math.round(e.karb_g)} · Y {Math.round(e.yag_g)}</Muted>
            </View>
            <Pressable onPress={() => run(api.deleteLog(e.id))} hitSlop={8}><Text style={{ color: colors.danger }}>Sil</Text></Pressable>
          </View>
        ))}
      </Card>

      {week.length ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 10 }}>Son 7 gün</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110 }}>
            {week.map((w) => {
              const h = Math.max(2, (w.totals.kcal / maxWeek) * 90);
              const d = new Date(w.date + "T12:00:00");
              return (
                <View key={w.date} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: colors.muted }}>{w.totals.kcal || ""}</Text>
                  <View style={{ width: 18, height: h, backgroundColor: w.date === today ? colors.primary : colors.primarySoft, borderRadius: 4 }} />
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{DAYS_SHORT[d.getDay()]}</Text>
                </View>
              );
            })}
          </View>
          {targets ? <Muted style={{ fontSize: 12, marginTop: 6 }}>Günlük hedef: {targets.kcal} kcal</Muted> : null}
        </Card>
      ) : null}
      <ErrorText error={error} />
    </View>
  );
}
