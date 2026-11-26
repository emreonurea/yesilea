import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { Button, Card, colors, ErrorText, Field, Loading, Muted, Screen } from "../components/ui";

const fmtDate = (s: string) => {
  const d = new Date(s.replace(" ", "T") + "Z");
  return d.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
};

export default function Notes() {
  const { data: notes, setData, error, setError, loading } = useLoad(api.notes);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      setData(editing ? await api.updateNote(editing, text) : await api.addNote(text));
      setText("");
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const remove = (id: string) =>
    Alert.alert("Notu sil", "Bu not silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { try { setData(await api.deleteNote(id)); } catch (e) { setError((e as Error).message); } } },
    ]);

  return (
    <Screen>
      <Card>
        <Field label={editing ? "Notu düzenle" : "Yeni not"} value={text} onChangeText={setText} multiline
          placeholder="ör. Pazar günü 6 kişilik yemek, annemin dolma tarifi…" style={{ minHeight: 90, textAlignVertical: "top" }} />
        <Button title={editing ? "Güncelle" : "Kaydet"} onPress={save} loading={busy} disabled={!text.trim()} />
        {editing ? <Button title="Vazgeç" kind="secondary" onPress={() => { setEditing(null); setText(""); }} /> : null}
      </Card>
      <ErrorText error={error} />
      {loading && !notes ? <Loading /> : null}
      {notes && !notes.length ? <Muted>Henüz not yok. Tarif fikirlerinizi, alışveriş hatırlatmalarınızı buraya yazabilirsiniz.</Muted> : null}
      {notes?.map((n) => (
        <Card key={n.id}>
          <Text style={{ fontSize: 15, color: colors.text }}>{n.text}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Muted style={{ fontSize: 12 }}>{fmtDate(n.updated_at)}</Muted>
            <View style={{ flexDirection: "row" }}>
              <Pressable onPress={() => { setEditing(n.id); setText(n.text); }} hitSlop={8}><Text style={{ color: colors.primary, marginRight: 16 }}>Düzenle</Text></Pressable>
              <Pressable onPress={() => remove(n.id)} hitSlop={8}><Text style={{ color: colors.danger }}>Sil</Text></Pressable>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
