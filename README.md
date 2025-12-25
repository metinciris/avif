# avif  
## Batch AVIF Converter (GUI)

### Resimleri klasör halinde `.avif` uzantıya çevirir

Basit ve hızlı bir **Windows GUI aracı**.  
Seçilen klasördeki **yalnızca üst dizindeki** `.jpg / .jpeg / .png` dosyalarını **AVIF** formatına dönüştürür.

> Alt klasörlere girmez.

---

## Özellikler

- ✅ `.jpg / .jpeg / .png` → `.avif`
- ✅ **Sadece seçilen klasör** (alt klasör yok)
- ✅ 100’den fazla dosyada **emin misin?** onayı
- ✅ İsim çakışmalarında otomatik:  
  `resim.avif`, `resim(2).avif`, `resim(3).avif` …
- ✅ **Progress bar + kalan süre (ETA)**
- ✅ İşlem sırasında canlı dosya adı gösterimi
- ✅ Başarıyla dönüştürülen dosyalarda **orijinal silinir**
- ✅ Yarım / bozuk dosya kalmaması için **temp → final** yazım
- ✅ İş bitince **kısa bip** ve otomatik kapanış
- ✅ Konsolsuz, tek tık **Windows EXE**

---

## Varsayılan Sıkıştırma Profili  

“Doküman arşivi” için optimize edilmiştir  
(**Renkli taranmış belgeler için dengeli ayar**)

```text
QUALITY     = 40
SPEED       = 3
SUBSAMPLING = 4:2:0
````

Bu profil:

* Dosya boyutunu ciddi şekilde düşürür
* Renkli taramalarda okunabilirliği korur
* Arşivleme ve uzun süreli saklama için uygundur

---

## Online Demo (Tarayıcı Üzerinden)

Uygulamanın kullandığı sıkıştırmaya **yakın bir AVIF çıktısını**,
**tek bir resim üzerinde**, doğrudan tarayıcıda deneyebilirsiniz.

🔗 **GitHub Pages Demo**
[https://metinciris.github.io/avif/](https://metinciris.github.io/avif/)

Demo özellikleri:

* Tek resim yükleme
* Dönüşüm tamamen **tarayıcı içinde** yapılır (dosya upload edilmez)
* Orijinal ve AVIF görüntüler **yan yana**
* **Senkron zoom & pan** ile detay karşılaştırma
* Dosya boyutu ve **sıkıştırma yüzdesi** gösterimi
* AVIF çıktıyı indirme

> Bu demo gösterim amaçlıdır; toplu dönüştürme için masaüstü uygulaması kullanılır.

---

## İndirme (Windows)

EXE dosyasını doğrudan GitHub **dist** klasöründen indirebilirsiniz:

👉 **BatchAVIF.exe**
[https://github.com/metinciris/avif/blob/main/dist/BatchAVIF.exe](https://github.com/metinciris/avif/blob/main/dist/BatchAVIF.exe)

> Dosyayı indirdikten sonra çift tıklayıp çalıştırmanız yeterlidir.
> Kurulum gerekmez.

---

## Kullanım

1. `BatchAVIF.exe` dosyasını çalıştır
2. Dönüştürülecek klasörü seç
3. Program otomatik olarak dönüştürmeye başlar
4. İş bitince kısa bir bip sesi duyulur ve program kapanır

---

## Notlar

* Dönüşüm **başarılı olursa** orijinal dosyalar silinir
* Hata oluşan dosyalar atlanır, işlem devam eder
* AVIF desteği `pillow-avif-plugin` ile sağlanmaktadır
* EXE, PyInstaller kullanılarak üretilmiştir

---

## Inspired by

This project was inspired by:

👉 **Batch JPEG to AVIF Converter**
[https://github.com/drobin04/Batch-JPEG-to-AVIF-Converter](https://github.com/drobin04/Batch-JPEG-to-AVIF-Converter)

The original project provides a basic GUI for batch JPEG → AVIF conversion.
This repository extends the idea with:

* Progress bar and ETA
* Top-level folder only processing (no subfolders)
* Safer file handling (temp → final write)
* Optimized defaults for scanned documents
* Color-aware compression profile
* Standalone Windows EXE distribution
* Browser-based online demo (GitHub Pages)

---

## Lisans

MIT License

```

