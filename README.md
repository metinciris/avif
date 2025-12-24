# avif
Batch JPEG/PNG to AVIF Converter (GUI)

Klasör seçerek **yalnızca üst klasördeki** `.jpg / .jpeg / .png` dosyalarını **AVIF** formatına çevirir.  
Dönüşüm başarılı olursa orijinal dosyayı siler (kalıntı bırakmamak için önce geçici dosyaya yazar).

> Not: Alt klasörlere girmez.

## Özellikler
- ✅ Üst klasördeki `.jpg/.jpeg/.png` → `.avif`
- ✅ 100+ dosyada onay sorar
- ✅ Çakışmada otomatik isimlendirme: `resim.avif`, `resim(2).avif`, ...
- ✅ Progress bar + ETA (kalan süre tahmini)
- ✅ İş bitince kısa bip ve otomatik kapanış
- ✅ Başarıyla dönüştürülenlerde orijinali siler (yarım dosya kalmasın diye temp->final)

## Varsayılan sıkıştırma profili (renkli scan için)
- `QUALITY = 40`
- `SPEED = 3`
- `SUBSAMPLING = "4:2:0"`

İstersen koddaki sabitleri değiştirerek ayarlayabilirsin.

## Kurulum (Python ile çalıştırma)
```bash
pip install pillow pillow-avif-plugin
python batch_to_avif_gui_noparallel.py

## Download (Windows)
EXE dosyasını GitHub **dist** sekmesinden indirebilirsiniz.
