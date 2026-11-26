# Kiro Account Switcher (Kiro Hesap Değiştirici)

<p align="center">
  <img src="media/icon-128.svg" alt="Kiro Hesap Değiştirici Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Birden fazla Kiro hesabını tek tıkla kaydedin, kota kullanımını canlı takip edin ve hesaplar arasında anında geçiş yapın.</strong>
</p>

<p align="center">
  <a href="README.md">🇬🇧 English Documentation</a> •
  <a href="#özellikler">Özellikler</a> •
  <a href="#hızlı-başlangıç">Hızlı Başlangıç</a> •
  <a href="#kullanım-kılavuzu">Kullanım Kılavuzu</a> •
  <a href="#ayarlar">Ayarlar</a> •
  <a href="#güvenlik">Güvenlik</a> •
  <a href="#geliştirme">Geliştirme</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/sürüm-2.0.0-blue.svg" alt="Sürüm 2.0.0" />
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC.svg?logo=visualstudiocode" alt="VS Code Sürümü" />
  <img src="https://img.shields.io/badge/lisans-MIT-green.svg" alt="MIT Lisansı" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Çapraz Platform" />
</p>

---

## ⚡ Genel Bakış

**Kiro Account Switcher**, Visual Studio Code (ve Cursor, VSCodium, Windsurf gibi VS Code tabanlı editörler) üzerinde Kiro AI kullanıcıları için geliştirilmiş kapsamlı bir hesap yönetim ve kota takip eklentisidir.

Yapay zeka kotanızı en verimli şekilde kullanmak için birden fazla Kiro hesabı kullanıyorsanız, kotanız bittiğinde sürekli çıkış yapıp tarayıcıdan yeniden giriş yapma zorunluluğunu tamamen ortadan kaldırır.

---

## ✨ Özellikler

- 🔄 **Tek Tıkla Hesap Değiştirme**: Kayıtlı hesaplarınız arasında saniyeler içinde geçiş yapın. Token dosyaları diske atomik olarak güvenle yazılır.
- 📊 **Canlı Kota ve Kredi Takibi**: Kiro'nun resmi `Get-Usage-Limits` API'sini sorgulayarak kullanılan/kalan kredileri, yenilenme tarihini, abonelik planını (Free, Pro vb.) ve kullanıcı e-postasını anlık gösterir.
- 🔑 **Çift Token Senkronizasyonu**: Hem VS Code eklentisi token dosyasını (`kiro-auth-token-code.json`) hem de masaüstü / global CLI token dosyasını (`kiro-auth-token.json`) eşzamanlı günceller.
- 🔁 **Akıllı Token Yenileme**: Süresi dolan token'ları otomatik tespit eder ve Google/GitHub gibi sosyal giriş token'larını Kiro masaüstü auth sunucusu üzerinden otomatik yeniler.
- 🎨 **Modern Kenar Çubuğu Arayüzü**: Özel renkli avatarlar, dinamik kota ilerleme çubukları, plan etiketleri ve sürükle-bırak sıralama desteği sunan şık Webview paneli.
- ⚡ **Hızlı Geçiş Paleti (`Ctrl+Shift+K` / `Cmd+Shift+K`)**: Klavyeden elinizi kaldırmadan hesaplar arasında hızlı geçiş yapma ve kotaları önizleme imkanı.
- 📌 **Durum Çubuğu (Status Bar) Entegrasyonu**: Aktif hesabın adını ve kota ilerleme grafiğini (`[████░░]`) doğrudan durum çubuğunda gösterir.
- 🛡️ **Şifreli Yedekleme ve Taşıma (Dışa / İçe Aktarma)**:
  - İsteğe bağlı **AES-256-GCM** şifreleme ve parola koruması ile hesapları güvenle dışa aktarma.
  - Yedek dosyalarını tek tıkla geri yükleme.
  - **Kiro Desktop** dışa aktarım dosyalarını doğrudan içe aktarma uyumluluğu.
- 🔒 **Güvenli Kimlik Depolama**: Erişim ve yenileme token'ları VS Code'un işletim sistemi destekli `SecretStorage` mekanizmasında (Windows Credential Manager, macOS Keychain, Linux Secret Service) saklanır.
- 🌐 **Çift Dil Desteği**: Türkçe ve İngilizce dillerini tam destekler; arayüzden anında dil değiştirilebilir.

---

## 🚀 Hızlı Başlangıç

### 1. Kurulum

#### VSIX Dosyasından Kurulum (Manuel)
1. Eklenti paketini oluşturun veya indirin:
   ```bash
   npm run package
   ```
2. VS Code içinde `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) tuşlarına basıp şu komutu çalıştırın:
   > **Extensions: Install from VSIX...**
3. Oluşturulan `kiro-account-switcher-2.0.0.vsix` dosyasını seçin.

*Alternatif olarak terminalden kurun:*
```bash
code --install-extension kiro-account-switcher-2.0.0.vsix
```

---

### 2. İlk Hesabınızı Kaydetme

1. VS Code'da resmi Kiro eklentisiyle ilk hesabınıza giriş yapın.
2. Sol Activity Bar'daki **Kiro Hesaplar** ikonuna tıklayın.
3. **"Mevcut Hesabı Kaydet"** butonuna (veya başlıktaki `+` simgesine) tıklayın.
4. Hesaba bir isim verin (örn. `Kişisel`, `İş`, `Hesap 1`).
5. Eklenti e-posta adresinizi ve kalan kotanızı otomatik olarak getirecektir!

---

### 3. Yeni Hesaplar Ekleme

1. Kenar çubuğundaki **"Çıkış Yap ve Yeni Hesap Ekle"** butonuna (kapı simgesi) tıklayın.
2. Aktif token dosyaları temizlenir ve Kiro sizi giriş ekranına yönlendirir.
3. Resmi Kiro panelinden ikinci hesabınızla giriş yapın.
4. **Kiro Hesap Değiştirici** paneline dönüp **"Mevcut Hesabı Kaydet"** deyin.
5. İstediğiniz kadar hesap eklemek için bu adımları tekrarlayın!

---

### 4. Hesaplar Arasında Geçiş Yapma

- **Kenar Çubuğundan**: Herhangi bir hesabın üzerindeki **"Geçiş Yap"** butonuna tıklayın.
- **Klavyeden**: `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) tuşlarına basarak hızlı geçiş paletini açın.
- **Durum Çubuğundan**: VS Code sağ alt köşesindeki Kiro göstergesine tıklayın.

> **İpucu**: Kiro, token dosyası değişikliklerini yaklaşık 3-5 saniye içinde otomatik algılar. Anında yenileme isterseniz ayarlardan `"kiroAccountSwitcher.autoReloadWindowOnSwitch": true` seçeneğini açabilirsiniz.

---

## ⌨️ Klavye Kısayolları

| Kısayol | Komut | Açıklama |
| :--- | :--- | :--- |
| `Ctrl+Shift+K` *(Windows/Linux)*<br>`Cmd+Shift+K` *(macOS)* | `kiroAccountSwitcher.quickSwitch` | Hızlı Hesap Değiştirme menüsünü açar |

---

## ⚙️ Yapılandırma Ayarları

VS Code Ayarlarından (`Ctrl+,` / `Cmd+,`) **Eklentiler > Kiro Hesap Değiştirici** bölümünden özelleştirilebilir:

| Ayar | Tür | Varsayılan | Açıklama |
| :--- | :--- | :--- | :--- |
| `kiroAccountSwitcher.syncBothTokenFiles` | `boolean` | `true` | Hesap değiştirirken veya çıkış yaparken hem `kiro-auth-token-code.json` hem de `kiro-auth-token.json` dosyalarını senkronize eder. |
| `kiroAccountSwitcher.fetchEmailAndQuota` | `boolean` | `true` | Kiro API'sinden kullanıcı e-postası, kullanıcı ID ve kota sınırlarını otomatik sorgular. |
| `kiroAccountSwitcher.autoReloadWindowOnSwitch` | `boolean` | `false` | Hesap değişiminden hemen sonra VS Code penceresini otomatik yeniden yükler. |
| `kiroAccountSwitcher.statusBarAlignment` | `"left"` \| `"right"` | `"right"` | Durum çubuğu simgesinin konumunu ayarlar (sol veya sağ). |
| `kiroAccountSwitcher.showProgressBar` | `boolean` | `true` | Durum çubuğu ipucunda metin tabanlı ilerleme çubuğu (`[████░░]`) gösterir. |

---

## 📂 Dosya Konumları ve Mimari

Eklenti, aşağıdaki dizinlerde bulunan token ve profil yapılandırmalarını yönetir:

- **SSO Önbellek Dizini**: `~/.aws/sso/cache/`
  - `kiro-auth-token-code.json` (VS Code Kiro eklentisi)
  - `kiro-auth-token.json` (Kiro Masaüstü / Global IDE)
  - `kiro-connection-code.json` & `kiro-connection.json`
- **Kullanıcı Profili**:
  - **Windows**: `%APPDATA%\Code\User\globalStorage\kiro.kiro-for-vscode\profile.json`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/kiro.kiro-for-vscode/profile.json`
  - **Linux**: `~/.config/Code/User/globalStorage/kiro.kiro-for-vscode/profile.json`

Dosya yazma işlemleri yarış durumlarını (race condition) ve bozulmaları önlemek için **atomik** (geçici dosyaya yazma + yeniden adlandırma) ve güvenli izinlerle (`0o600`) gerçekleştirilir.

---

## 🔒 Güvenlik ve Gizlilik

- **Güvenli Kimlik Depolama**: Token'lar düz metin olarak ayarlarda saklanmaz. İşletim sisteminin yerel kimlik kasası tarafından korunan `vscode.SecretStorage` içinde tutulur.
- **Parolalı Dışa Aktarma**: Hesap yedekleri, kullanıcı tarafından belirlenen bir parola ile **PBKDF2** anahtar türetimi (100.000 iterasyon) ve **AES-256-GCM** algoritması ile şifrelenebilir.
- **Doğrudan API İletişimi**: Kota sorgulama ve token yenileme istekleri yalnızca doğrudan resmi Kiro uç noktalarına (`desktop.kiro.dev`) yapılır. Hiçbir üçüncü taraf sunucu veya telemetri kullanılmaz.
- **Sembolik Bağlantı (Symlink) Koruması**: Güvenlik açıklarını önlemek için dosya erişimleri symlink traversal kontrollerinden geçirilir.

---

## 🛠️ Geliştirme ve Derleme

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18.0.0 veya üzeri önerilir)
- [npm](https://www.npmjs.com/)

### Projeyi Klonlama ve Kurulum
```bash
git clone https://github.com/KULLANICI_ADINIZ/kiro-account-switcher.git
cd kiro-account-switcher
npm install
```

### Kullanılabilir Komutlar

| Komut | Açıklama |
| :--- | :--- |
| `npm run build` | `esbuild` kullanarak projeyi `dist/extension.js` dosyasına derler |
| `npm run watch` | Kaynak dosyaları izler ve değişikliklerde otomatik yeniden derler |
| `npm run typecheck` | Dosya üretmeden TypeScript tip denetimini çalıştırır (`tsc --noEmit`) |
| `npm run package` | Eklentiyi kurulabilir `.vsix` paketi haline getirir (`@vscode/vsce`) |

### Hata Ayıklama (Debug)
1. Projeyi VS Code ile açın.
2. `F5` tuşuna basarak yeni bir **Extension Development Host** penceresi başlatın.
3. Yaptığınız değişiklikleri bu pencerede test edin.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
