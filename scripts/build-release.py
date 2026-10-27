"""Create a static deployment directory only after the actual catalog passes."""
import importlib.util,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('vocabulary',ROOT/'scripts/validate-vocabulary.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
words=mod.validate(ROOT)
dest=ROOT/'dist';dest.mkdir(exist_ok=True)
for name in ['index.html','styles.css','app.js','db.js','learning.js','sw.js','manifest.webmanifest']:
 shutil.copy2(ROOT/name,dest/name)
for name in ['icons','data']:
 shutil.copytree(ROOT/name,dest/name,dirs_exist_ok=True)
assert len(mod.validate(dest))==len(words)
print(f'Release artifact verified: {dest} - {len(words)} unique words')
