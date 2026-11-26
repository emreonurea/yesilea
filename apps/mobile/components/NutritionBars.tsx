import { Text, View } from "react-native";
import { MICRO_KEYS, MICRO_LABELS, type Nutrition, type Targets } from "@menu/shared";
import { colors, Muted } from "./ui";

function Bar({ label, value, target, unit, limit }: { label: string; value: number; target?: number; unit: string; limit?: boolean }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const over = target != null && value > target * (limit ? 1 : 1.15);
  const fmt = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("tr-TR");
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
        <Text style={{ color: over ? colors.danger : colors.muted, fontSize: 13 }}>
          {fmt(value)}{target ? ` / ${fmt(target)}` : ""} {unit}{limit ? " (üst sınır)" : ""}
        </Text>
      </View>
      {target ? (
        <View style={{ height: 6, backgroundColor: "#EEE7DD", borderRadius: 3, marginTop: 4 }}>
          <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: over ? colors.danger : colors.ok, borderRadius: 3 }} />
        </View>
      ) : null}
    </View>
  );
}

/** Makro ve mikro besinleri hedefle birlikte (varsa) gösterir. */
export function NutritionBars({ n, targets, micros = true }: { n: Nutrition; targets?: Targets | null; micros?: boolean }) {
  return (
    <View>
      <Bar label="Enerji" value={n.kcal} target={targets?.kcal} unit="kcal" />
      <Bar label="Protein" value={n.protein_g} target={targets?.protein_g} unit="g" />
      <Bar label="Karbonhidrat" value={n.karb_g} target={targets?.karb_g} unit="g" />
      <Bar label="Yağ" value={n.yag_g} target={targets?.yag_g} unit="g" />
      {micros ? (
        <>
          <Text style={{ fontWeight: "700", color: colors.text, marginTop: 6, marginBottom: 8 }}>Mikro besinler</Text>
          {MICRO_KEYS.filter((k) => n.micros[k] != null).map((k) => (
            <Bar key={k} label={MICRO_LABELS[k].label} value={n.micros[k] as number} target={targets?.micros[k]} unit={MICRO_LABELS[k].unit} limit={MICRO_LABELS[k].limit} />
          ))}
          {MICRO_KEYS.every((k) => n.micros[k] == null) ? <Muted>Mikro besin bilgisi yok.</Muted> : null}
        </>
      ) : null}
    </View>
  );
}

export function MacroLine({ n }: { n: Nutrition }) {
  return <Muted style={{ fontSize: 12 }}>{n.kcal} kcal · P {n.protein_g} g · K {n.karb_g} g · Y {n.yag_g} g</Muted>;
}
