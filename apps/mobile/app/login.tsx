import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Link } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, colors, ErrorText, Field, Muted, Screen, Title } from "../components/ui";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
};
const googleEnabled = !!(Platform.OS === "ios" ? GOOGLE.iosClientId : GOOGLE.androidClientId);

function GoogleButton({ onToken, onError }: { onToken: (t: string) => void; onError: (m: string) => void }) {
  const [request, response, prompt] = Google.useIdTokenAuthRequest(GOOGLE);
  useEffect(() => {
    if (response?.type === "success" && response.params.id_token) onToken(response.params.id_token);
    else if (response?.type === "error") onError("Google ile giriş yapılamadı.");
  }, [response]);
  return <Button title="Google ile devam et" kind="secondary" disabled={!request} onPress={() => prompt()} />;
}

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleOk, setAppleOk] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleOk).catch(() => {});
  }, []);

  async function run(f: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try { await f(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const sendCode = () => run(async () => {
    const r = await api.startEmail(email.trim());
    setDevCode(r.dev_code ?? null);
    setSent(true);
  });
  const verify = () => run(async () => signIn((await api.verifyEmail(email.trim(), code.trim())).token));

  const apple = () => run(async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (!cred.identityToken) throw new Error("Apple ile giriş yapılamadı.");
      await signIn((await api.apple(cred.identityToken)).token);
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      throw e;
    }
  });

  return (
    <Screen>
      <Title>Yeşilea</Title>
      <Muted style={{ marginBottom: 20 }}>Evdeki malzemelere ve bütçenize göre haftalık menü, tek dokunuşla akşam yemeği önerisi ve market listesi.</Muted>

      {!sent ? (
        <>
          <Field label="E-posta" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <Button title="Giriş kodu gönder" onPress={sendCode} loading={busy} disabled={!email} />
        </>
      ) : (
        <>
          <Muted style={{ marginBottom: 8 }}>{email} adresine 6 haneli bir kod gönderdik.</Muted>
          {devCode ? <Text style={{ color: colors.ok, marginBottom: 8 }}>Test sürümü giriş kodu: {devCode}</Text> : null}
          <Field label="Kod" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <Button title="Giriş yap" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button title="Farklı e-posta" kind="secondary" onPress={() => { setSent(false); setCode(""); }} />
        </>
      )}

      <View style={{ marginTop: 16 }}>
        {appleOk ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: 48, marginVertical: 6 }}
            onPress={apple}
          />
        ) : null}
        {googleEnabled ? (
          <GoogleButton onToken={(t) => run(async () => signIn((await api.google(t)).token))} onError={setError} />
        ) : null}
      </View>

      <ErrorText error={error} />
      <Link href="/privacy" style={{ color: colors.primary, marginTop: 16 }}>Gizlilik politikası</Link>
    </Screen>
  );
}
