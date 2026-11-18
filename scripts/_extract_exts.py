import zipfile
from pathlib import Path

pairs = [
    (Path(r"c:\Users\a\OneDrive\바탕 화면\0.3.65_0.zip"), Path(r"c:\Users\a\Downloads\duplicate-of\_ext_analyze\chrome_0.3.65")),
    (Path(r"c:\Users\a\Downloads\WINGS_Local_0.1.zip"), Path(r"c:\Users\a\Downloads\duplicate-of\_ext_analyze\wings_0.1")),
]

for src, dst in pairs:
    print("SRC exists:", src.exists(), src)
    if not src.exists():
        continue
    if dst.exists():
        import shutil
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src, "r") as z:
        z.extractall(dst)
    files = sorted(dst.rglob("*"))
    print(f"\n=== {src.name} -> {dst} ({sum(1 for f in files if f.is_file())} files) ===")
    for f in files:
        if f.is_file():
            rel = f.relative_to(dst)
            print(f"{rel} ({f.stat().st_size})")
