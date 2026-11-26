import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatQty, UNITS, type UnitKey } from "@menu/shared";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, Card, Chip, colors, ErrorText, Field, Loading, Muted, s, Screen } from "../../components/ui";

const QUICK = ["domates", "kuru soğan", "patates", "yumurta", "süt", "yoğurt", "beyaz peynir", "tavuk göğsü", "dana kıyma", "pirinç", "bulgur", "kırmızı mercimek", "makarna", "un", "sarımsak", "biber", "havuç", "ıspanak", "limon", "zeytinyağı"];
const COMMON_UNITS: UnitKey[] = ["adet", "g", "kg", "ml", "l", "su_bardagi", "yemek_kasigi", "demet"];

const today = () => new Date().toISOString().slice(0, 10);
const daysLeft = (d: string) => Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400_000);

export default function Pantry() {
  const { data: items, error, setError, loading, reload } = useLoad(api.pantry);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<UnitKey>("adet");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(n = name) {
    if (!n.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPantry({
        name: n.trim().toLocaleLowerCase("tr-TR"),
        qty: qty ? Number(qty.replace(",", ".")) : null,
        unit: qty ? unit : null,
        expires_on: expires || null,
      });
      setName(""); setQty(""); setExpires("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try { await api.deletePantry(id); await reload(); } catch (e) { setError((e as Error).message); }
  }

  const have = new Set((items ?? []).map((i) => i.name));

  return (
    <Screen>
      <Card>
        <Field label="Malzeme" value={name} onChangeText={setName} placeholder="ör. domates" />
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Miktar (isteğe bağlı)" keyboardType="decimal-pad" value={qty} onChangeText={setQty} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Son kullanma (YYYY-AA-GG)" value={expires} onChangeText={setExpires} placeholder={today()} />
          </View>
        </View>
        {qty ? (
          <View style={[s.wrap, { marginBottom: 4 }]}>
            {COMMON_UNITS.map((u) => <Chip key={u} label={UNITS[u].label} selected={unit === u} onPress={() => setUnit(u)} />)}
          </View>
        ) : null}
        <Button title="Ekle" onPress={() => add()} loading={busy} disabled={!name.trim()} />
      </Card>

      <Text style={s.label}>Listeden hızlı ekle</Text>
      <View style={[s.wrap, { marginBottom: 12 }]}>
        {QUICK.filter((q) => !have.has(q)).map((q) => <Chip key={q} label={`+ ${q}`} selected={false} onPress={() => add(q)} />)}
      </View>

      <ErrorText error={error} />
      {loading && !items ? <Loading /> : null}
      {items && !items.length ? <Muted>Henüz malzeme eklemediniz. Menüler evdekileri önce kullanacak şekilde hazırlanır.</Muted> : null}
      {items?.map((i) => {
        const left = i.expires_on ? daysLeft(i.expires_on) : null;
        return (
          <Card key={i.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: colors.text }}>{i.name}</Text>
              <Muted style={{ fontSize: 12 }}>
                {i.qty && i.unit ? formatQty(i.qty, i.unit) : "Miktar girilmedi"}
                {left != null ? ` · ${left < 0 ? "tarihi geçti" : left === 0 ? "bugün bitiyor" : `${left} gün kaldı`}` : ""}
              </Muted>
            </View>
            <Pressable onPress={() => remove(i.id)} hitSlop={8} accessibilityLabel={`${i.name} sil`}>
              <Text style={{ color: colors.danger }}>Sil</Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}

