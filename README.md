# avif
Batch AVIF Converter (GUI)
Resimleri klasör halinde .avif uzantıya çevirir

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
- ✅ Yarım/bozuk dosya kalmaması için **temp → final** yazım
- ✅ İş bitince **kısa bip** ve otomatik kapanış
- ✅ Konsolsuz, tek tık EXE

---

## Varsayılan Sıkıştırma Profili  
(**Renkli taranmış belgeler için dengeli ayar**)

```text
QUALITY     = 40
SPEED       = 3
SUBSAMPLING = 4:2:0
````

Bu profil:

* Dosya boyutunu ciddi düşürür
* Renkli taramalarda okunabilirliği korur

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
* Hata oluşan dosyalar atlanır
* AVIF desteği `pillow-avif-plugin` ile sağlanmaktadır
* EXE PyInstaller ile üretilmiştir

---

## Inspired by

This project was inspired by and builds upon the work in:

👉 [Batch JPEG to AVIF Converter](https://github.com/drobin04/Batch-JPEG-to-AVIF-Converter)

Original project provides a simple GUI for converting JPEG to AVIF images.  
This repository extends that idea with:

- Progress bar + ETA (estimated time remaining)
- Only top-level folder processing (no subfolders)
- Auto parallel conversion based on CPU cores
- Intelligent output name collision handling
- Better defaults for scanned images and color preservation
- Demo mode for testing multiple AVIF encoding settings
- Standalone Windows EXE distribution


## Lisans

MIT License
