# DeepSeek Usage — sebuah widget Plasma 6

- 🇬🇧/🇺🇸 [![English](https://img.shields.io/badge/Language-English-blue)](README.md)
- 🇨🇳 [![简体中文](https://img.shields.io/badge/Language-简体中文-EE1C25)](README.zh-CN.md)
- 🇮🇳 [![हिन्दी](https://img.shields.io/badge/Language-हिन्दी-FF9933)](README.hi-IN.md)
- 🇫🇷 [![Français](https://img.shields.io/badge/Language-Français-0055A4)](README.fr-FR.md)
- 🇷🇺 [![Русский](https://img.shields.io/badge/Language-Русский-0039A6)](README.ru-RU.md)
- 🇪🇸 [![Español](https://img.shields.io/badge/Language-Español-F1BF00)](README.es-ES.md)

> [!NOTE]
> Berkas ini adalah terjemahan mesin dari README berbahasa Inggris dan belum
> pernah ditinjau oleh penutur asli. Versi Inggris `README.md` adalah rujukan
> yang berwenang; kebijakan penerjemahan dijelaskan di `translate/README.md`.

Applet KDE Plasma 6 kecil tanpa dependensi yang menampilkan saldo dan
penggunaan API DeepSeek Anda di panel, dengan popup yang terperinci.

- **Panel:** ikon ditambah angka yang Anda pilih (saldo, pengeluaran hari ini,
  token hari ini, pengeluaran periode, atau pengeluaran seumur hidup).
- **Popup:** saldo, pengeluaran hari ini/periode/seumur hidup, perkiraan "sisa
  hari", token masuk/keluar/cache dan jumlah permintaan, sparkline pengeluaran
  harian, serta rincian per kunci API.
- **Rahasia disimpan di KWallet**, tidak pernah di berkas konfigurasi widget.
- **Tanpa dependensi runtime** selain Plasma dan Qt: akses jaringan memakai
  `XMLHttpRequest` QML, penguraian memakai JavaScript biasa, dan KWallet
  dijangkau melalui `kwallet-query`.

![Mode lengkap](docs/images/rich-mode.id-ID.png)

Sebagai chip panel — ikon, angka yang Anda pilih, dan titik jam sibuk/luar jam
sibuk:

![Chip panel](docs/images/panel-mode.png)

## Instalasi

```sh
./install.sh            # install or upgrade for the current user
./install.sh --pack     # write deepseek-usage.plasmoid for distribution
./install.sh --uninstall
```

Lalu tambahkan **DeepSeek Usage** ke panel atau desktop. Klik kanan widget →
*Configure…* untuk menambahkan kredensial Anda.

## Kredensial

Ada dua kredensial yang berbeda, dan keduanya tidak dapat dipertukarkan.

| | Kunci API | Token sesi |
|---|---|---|
| Cara memperolehnya | <https://platform.deepseek.com/api_keys> | nilai yang disimpan situs platform setelah Anda masuk |
| Cakupan | akses API akun Anda | **akses akun penuh**, termasuk membuat dan menghapus kunci API |
| Yang Anda dapatkan | hanya saldo | saldo, pengeluaran seumur hidup, dan riwayat penggunaan |
| Disimpan sebagai | `deepseek-api-key` di KWallet | `deepseek-session-token` di KWallet |

Keduanya ditulis ke KWallet (wallet `kdewallet`, folder `Plasma`) dan dibaca
kembali dengan `kwallet-query`. Kunci API saja sudah cukup untuk saldo;
menambahkan token sesi mengaktifkan bagian penggunaan. Jika token sesi berhenti
berfungsi, widget kembali ke saldo dan memberi tahu Anda penyebabnya.

> [!WARNING]
> Token sesi sama kuatnya dengan kata sandi Anda. Perlakukan seperti kata sandi,
> dan hapus dari KWallet jika Anda berhenti memakai mode lengkap.

## Sumber data

Widget ini bersifat hibrida karena DeepSeek mengekspos dua API yang tidak
berkaitan.

**API resmi** (`api.deepseek.com`) — diautentikasi dengan kunci API,
terdokumentasi, andal, tetapi hanya melaporkan saldo:

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <API_KEY>
```

**API platform** (`platform.deepseek.com/api/v0`) — backend di balik halaman
penggunaan web. API ini diautentikasi dengan sesi dan **tidak terdokumentasi**,
sehingga bisa berubah kapan saja:

```
GET /users/get_user_summary
GET /usage/by_api_key/amount?start=&end=&tz=
GET /usage/by_api_key/cost?start=&end=&tz=
authorization: Bearer <SESSION_TOKEN>
```

Dua keanehan yang perlu diketahui:

- API platform menjawab **HTTP 200 bahkan untuk kegagalan autentikasi**, dengan
  status sebenarnya diletakkan di badan JSON (`{"code":40003,...}`). Karena itu
  widget mengklasifikasikan hasil dari payload, bukan dari status HTTP.
- Payload biaya dan token menyusun serinya secara berbeda
  (`data.biz_data.data[] .series[]` untuk biaya, `data.biz_data.series[]` untuk
  token).

Karena tidak ada endpoint "usage" yang terdokumentasi, angka pengeluaran dan
nilai "perkiraan sisa hari" **diturunkan** dari API ini dan diberi label
demikian di popup.

## Konfigurasi

| Pengaturan | Bawaan | Arti |
|---|---|---|
| Interval penyegaran | 300 s | seberapa sering melakukan polling (minimum 30 s) |
| Panel menampilkan | Saldo | angka mana yang muncul di panel |
| Periode biaya | 30 hari | jendela untuk total periode dan sparkline |
| Sembunyikan semua jumlah | nonaktif | ganti setiap jumlah di layar dengan titik-titik |

Rincian per kunci hanya mencantumkan **nama** kunci API. ID kunci tersamarkan
yang dilaporkan platform sengaja tidak pernah ditampilkan di mana pun.

## Harga jam sibuk dan luar jam sibuk

DeepSeek mengenakan setengah harga di luar jam sibuknya, sehingga widget
menunjukkan tarif mana yang sedang berlaku: titik kecil pada chip panel, serta
status dan sisa waktu di dalamnya pada popup dan tooltip.

- **hijau** — di luar jam sibuk: Anda membayar tarif berdiskon
- **merah** — jam sibuk: Anda membayar harga penuh
- **netral** — tidak diketahui: lihat di bawah

Jadwalnya [terdokumentasi](https://api-docs.deepseek.com/quick_start/pricing)
sebagai *01:00–04:00 dan 06:00–10:00 UTC, Senin sampai Jumat, tidak termasuk
hari libur nasional Tiongkok*; semua jam lain di luar jam sibuk, termasuk akhir
pekan dan hari libur sepenuhnya.

### Mengapa bisa tertulis "Tidak diketahui"

Bagian hari kerja dan waktu dalam aturan itu pasti dan selalu berlaku.
Pengecualian hari libur berbeda: Dewan Negara menerbitkan tanggal tahun
berikutnya hanya pada November atau Desember dan bisa merevisinya, jadi itu
adalah data yang harus dipelihara secara manual dan tidak dapat diturunkan.

Karena itu widget tidak akan menebak. `CHINESE_HOLIDAYS` di
`contents/ui/js/peak.js` menyimpan jadwal yang diterbitkan, blok demi blok,
untuk tahun-tahun yang telah diumumkan:

```js
addRange("2026-10-01", "2026-10-07"); // National Day
```

Ketika ditanya tentang tahun yang tidak tercakup tabel, statusnya dilaporkan
sebagai **Tidak diketahui** alih-alih menganggap hari-hari itu sebagai hari
kerja biasa — anggapan seperti itu akan melaporkan jam sibuk padahal DeepSeek
sedang mengenakan tarif luar jam sibuk. Tanggal perkiraan juga tidak boleh
ditambahkan, karena alasan yang sama dalam arah sebaliknya: entri yang salah
akan mengklaim diskon yang tidak ada.

### Menjaganya tetap mutakhir

`node --test tests/peak.test.mjs` menyertakan alarm pemeliharaan yang
disengaja: pengujian itu **gagal begitu tabel tidak lagi mencakup tahun
berjalan**, dan juga gagal jika ada tahun yang tercakup tampak terisi separuh.
Tambahkan tahun yang baru diterbitkan dengan `addRange()` dan pengujian kembali
hijau. Diumumkan pada November/Desember untuk tahun berikutnya, jadi itulah
tugas sekali setahun.

## Pengembangan

Logika penguraian, pemformatan, dan perintah KWallet berada di modul JavaScript
biasa di bawah `contents/ui/js/` sehingga dapat diuji tanpa sesi Plasma:

```sh
node --test tests/api.test.mjs tests/format.test.mjs tests/wallet.test.mjs
```

`tests/mock-platform-server.mjs` menyajikan bentuk payload yang terekam dari
API platform, yang merupakan satu-satunya cara menguji mode lengkap tanpa
kredensial sungguhan. Arahkan `PLATFORM_BASE` di `contents/ui/js/api.js` ke
`http://127.0.0.1:8731/api/v0` selama Anda menguji, lalu kembalikan.

Pemeriksaan statis untuk sisi QML:

```sh
qmllint contents/ui/*.qml contents/config/config.qml
```

Merender applet sekali per locale, untuk menemukan mojibake atau teks yang
meluap dari popup (Hindi dan Rusia jauh lebih panjang daripada bahasa Inggris):

```sh
tests/capture-locales.sh /tmp/shots zh_CN ru_RU hi_IN
```

### Integrasi berkelanjutan

Pemeriksaan di atas dijalankan di CI (`.github/workflows/ci.yml`), pada runner
Ubuntu standar dan tanpa Plasma: `node --test`, `./translate/build.sh --check`,
pemeriksaan sintaks QML dengan `qmllint`, dan `./install.sh --pack` untuk
membuktikan arsip distribusi masih dapat dibangun. `qmllint` pada Qt 6 tidak
me-resolve impor apa pun, sehingga tidak memerlukan paket KDE, dan itulah yang
membuat job tersebut bisa dijalankan sama sekali.

Satu workflow tidak berjalan saat push. `.github/workflows/holiday-alarm.yml`
menjalankan `tests/peak.test.mjs` pada tanggal satu setiap bulan, karena berkas
itu berisi alarm yang disengaja: gagal begitu tabel hari libur Tiongkok berhenti
mencakup tahun berjalan, sementara Dewan Negara hanya menerbitkan tanggal tahun
berikutnya pada November atau Desember. Hasil merah di sana adalah pengingat
untuk menambahkan blok yang telah diterbitkan dengan `addRange()`, bukan bug.

## Terjemahan

Widget ini menyertakan 17 katalog: Tionghoa Sederhana, Inggris (India), Hindi,
Indonesia, Prancis, Rusia (Rusia dan Belarus), Spanyol (Spanyol dan empat
varian Amerika Latin), ditambah alias bahasa tanpa wilayah yang memperluas
fallback locale Qt. Terjemahan berada di `translate/`; lihat
[`translate/README.md`](translate/README.md) untuk alur kerja dan format
tabelnya.

README ini juga diterjemahkan; tautan bahasa di bagian atas halaman menunjuk ke
berkas-berkas tersebut. Berkas-berkas itu adalah **terjemahan mesin dari
dokumen ini, dijaga satu berkas per bahasa** — varian katalog regional (`en_IN`,
`ru_BY`, `es_419` dan empat kode Spanyol Amerika Latin) berbagi README
bahasanya alih-alih mengulanginya.

```sh
./translate/merge.sh          # re-extract template.pot after changing i18n() calls
./translate/build.sh          # regenerate .po and compile .mo
./translate/build.sh --check  # CI: fail if any catalogue is out of date
```

> [!WARNING]
> **Setiap katalog dihasilkan oleh mesin dan belum pernah ditinjau oleh penutur
> asli.** Setiap `.po` mencatat hal ini di headernya, dan bidang
> `Language-Team`-nya masih berupa placeholder gettext "tidak ada katalog yang
> diklaim". Perlakukan semuanya sebagai titik awal, bukan terjemahan yang sudah
> selesai.
>
> **Prioritas peninjauan: Hindi, Rusia, dan Tionghoa Sederhana** — bahasa yang
> paling mungkin digunakan widget ini, dan bahasa yang paling tidak dapat
> diterima jika terjemahannya belum ditinjau. Selebihnya adalah bonus.

Rute yang dipilih untuk memperbaikinya adalah **tim penerjemahan KDE sendiri**
(keputusan D13): itu satu-satunya cara yang menghasilkan terjemahan yang
*ditinjau* oleh orang yang benar-benar menguasai bahasanya. `Messages.sh` di
akar repositori sudah menjadi titik masuk yang diharapkan perkakas KDE, dan
`translate/README.md` mencantumkan langkah-langkah konkretnya — prasyarat
utamanya adalah widget harus berada di repositori KDE sebelum tim tersebut dapat
mengambilnya. Konfigurasi Crowdin/Transifex disimpan hanya sebagai cadangan,
secara eksplisit ditandai belum pernah dijalankan.

## Lisensi

GPL-2.0-or-later. Lihat `LICENSE`.
