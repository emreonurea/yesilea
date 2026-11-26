import { Text } from "react-native";
import { colors, Muted, Screen, Title } from "../components/ui";

// TASLAK: Yayından önce bir hukukçuya kontrol ettirilmelidir.
const SECTIONS: [string, string][] = [
  ["Hizmet", "Yeşilea; menü, tarif, market listesi ve beslenme takibi sunan bir uygulamadır. Uygulamayı kullanarak bu koşulları kabul etmiş olursunuz."],
  ["Tıbbi tavsiye değildir", "Uygulamadaki tarifler, besin değerleri, kalori ve makro hedefleri genel bilgi amaçlıdır ve tahminidir. Tıbbi tavsiye, teşhis ya da tedavi yerine geçmez. Hamilelik, kronik hastalık, yeme bozukluğu öyküsü ya da düzenli ilaç kullanımı varsa beslenme planınızı bir doktor ya da diyetisyenle belirleyin."],
  ["Alerjenler ve helal", "Alerjen ve helal etiketleri otomatik kontrollerle üretilir ve hatalı olabilir. Ürün etiketlerini, helal kesim ve sertifikayı kendiniz kontrol edin. Uygulama dini hüküm vermez."],
  ["Hesap", "Hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı Ayarlar'dan istediğiniz zaman silebilirsiniz."],
  ["Premium abonelik", "Premium, App Store ya da Google Play üzerinden satın alınan otomatik yenilenen bir aboneliktir. Ücret satın alma onayında hesabınızdan alınır. Dönem bitiminden en az 24 saat önce iptal edilmezse abonelik yenilenir. Aboneliği mağaza hesap ayarlarınızdan yönetebilirsiniz. İadeler ilgili mağazanın kurallarına tabidir."],
  ["Kullanım kuralları", "Uygulamayı yasalara aykırı amaçlarla, başkalarının haklarını ihlal edecek şekilde ya da sistemi aşırı yükleyecek otomatik araçlarla kullanamazsınız."],
  ["Sorumluluğun sınırı", "Uygulama olduğu gibi sunulur. Yasaların izin verdiği ölçüde, tariflerin uygulanmasından ya da içeriklerin kullanılmasından doğan zararlardan sorumluluk kabul edilmez."],
  ["Değişiklikler ve iletişim", "Bu koşullar güncellenebilir; önemli değişikliklerde uygulama içinde bilgilendirilirsiniz. İletişim: [iletişim e-postası]."],
];

export default function Terms() {
  return (
    <Screen>
      <Title>Kullanım koşulları (taslak)</Title>
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
