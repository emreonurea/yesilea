import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { COST_NOTE, formatTry, UNITS, type UnitKey } from "@menu/shared";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { Button, Card, Chip, colors, ErrorText, Field, Muted, s, Screen } from "../components/ui";

const PRICE_UNITS: UnitKey[] = ["kg", "g", "l", "adet", "demet"];

export default function Prices() {
  const { data: prices, setData, error, setError } = useLoad(api.prices);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<UnitKey>("kg");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      setData(await api.savePrice({ name: name.trim().toLocaleLowerCase("tr-TR"), unit, price_try: Number(price.replace(",", ".")) }));
      setName(""); setPrice("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>{COST_NOTE} Fiyatları uygulama tahmin etmez.</Muted>
      <Card>
        <Field label="Malzeme" value={name} onChangeText={setName} placeholder="ör. domates" />
        <Field label="Fiyat (TL)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="ör. 40" />
        <Text style={s.label}>Birim</Text>
        <View style={s.wrap}>
          {PRICE_UNITS.map((u) => <Chip key={u} label={`1 ${UNITS[u].label}`} selected={unit === u} onPress={() => setUnit(u)} />)}
        </View>
        <Button title="Kaydet" onPress={save} loading={busy} disabled={!name.trim() || !price} />
      </Card>
      <ErrorText error={error} />
      {prices?.map((p) => (
        <Card key={p.name} style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{p.name}</Text>
          <Muted style={{ marginRight: 12 }}>{formatTry(p.price_try)} / {UNITS[p.unit].label}</Muted>
          <Pressable onPress={async () => setData(await api.deletePrice(p.name))} hitSlop={8}><Text style={{ color: colors.danger }}>Sil</Text></Pressable>
        </Card>
      ))}
    </Screen>
  );
}
