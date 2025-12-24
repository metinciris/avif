UPX İLE EXE OLUŞTURMA (İLERİDE GÜNCELLEME İÇİN)
1️⃣ UPX indir

https://github.com/upx/upx/releases

Örneğin: C:\upx\upx.exe

2️⃣ PyInstaller + UPX (tek dosya, konsolsuz)

```text
python -m PyInstaller ^
  --onefile ^
  --noconsole ^
  --name "BatchAVIF" ^
  --icon icon.ico ^
  --hidden-import=pillow_avif ^
  --upx-dir C:\upx ^
  batch_to_avif_gui_noparallel.py
````

UPX genelde EXE boyutunu %25–40 küçültür
(örn. 34 MB → ~20–24 MB)

⚠️ Notlar

Bazı antivirüsler UPX sıkıştırılmış EXE’lerde false-positive verebilir

Olursa UPX’siz build kullan (--upx-dir olmadan)
