import { Text } from "react-native";
import { colors, Muted, Screen, Title } from "../components/ui";

// TASLAK: Yayından önce bir hukukçuya kontrol ettirilmeli ve veri sorumlusu bilgileri doldurulmalıdır.
const SECTIONS: [string, string][] = [
  ["Veri sorumlusu", "Yeşilea uygulaması. İletişim: emreonurea@gmail.com"],
  ["Hangi verileri topluyoruz?", "Hesap: e-posta adresiniz ya da Apple/Google hesap kimliğiniz. Tercihler: hane kişi sayısı, bütçe, diyet tercihi, sevmediğiniz yiyecekler, renk teması. Mutfak: evdeki malzemeler, birim fiyatlar, menüleriniz, kendi tarifleriniz, beğendiğiniz/beğenmediğiniz tarifler, notlarınız. Sağlık verileri (yalnızca açık rızanızla): alerjiler, cinsiyet, yaş, boy, kilo, hareket düzeyi ve hedefiniz, yemek, su ve kilo kayıtlarınız."],
  ["Neden topluyoruz?", "Size uygun menü, tarif ve market listesi hazırlamak ve hesabınızı yönetmek için. Verilerinizi reklam amacıyla kullanmıyor ve satmıyoruz."],
  ["Sağlık verileri ve açık rıza", "Alerji, vücut bilgileri ve yemek/kilo kayıtları KVKK'ya göre özel nitelikli kişisel veridir. Bunları yalnızca açık rızanızla, size uygun tarif, menü ve beslenme hedefleri sunmak için işleriz. Rızanızı Ayarlar → \"Sağlık verilerimi sil, rızamı geri al\" ile istediğiniz zaman geri alabilirsiniz; bu verileriniz silinir."],
  ["Yiyecek arama", "Yiyecek veritabanındaki arama ve kalori hesabı telefonunuzda yapılır; aramalarınız hiçbir yere gönderilmez. Eklediğiniz kayıtlar hesabınızda saklanır."],
  ["Verileriniz kimlerle paylaşılır?", "Menü ve tarif hazırlamak için tercihleriniz, alerjileriniz, evdeki malzemeleriniz ve (diyet programı açıksa) günlük besin hedefleriniz yapay zekâ hizmet sağlayıcımıza (Anthropic, ABD) iletilir; e-posta adresiniz, kiloniz ve yemek kayıtlarınız iletilmez. Bu aktarım yurt dışına veri aktarımıdır ve açık rızanıza dayanır. Verilerinizi reklam şirketleriyle paylaşmayız."],
  ["Saklama süresi", "Hesabınız açık olduğu sürece saklanır. Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinir."],
  ["Haklarınız (KVKK md. 11)", "Verilerinize erişme, düzeltme, silme ve itiraz etme hakkınız vardır. Ayarlar ekranından verilerinizi indirebilir ve hesabınızı silebilirsiniz. Diğer talepler için: emreonurea@gmail.com"],
];

export default function Privacy() {
  return (
    <Screen>
      <Title>Gizlilik politikası (taslak)</Title>
      {SECTIONS.map(([h, b]) => (
        <Text key={h} style={{ marginBottom: 14 }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>{h}{"\n"}</Text>
          <Text style={{ color: colors.text }}>{b}</Text>
        </Text>
      ))}
      <Muted>Son güncelleme: taslak</Muted>
    </Screen>
  );
}
