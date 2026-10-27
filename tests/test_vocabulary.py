import unittest,tempfile,shutil,json,hashlib,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class VocabularyNegativeTests(unittest.TestCase):
 def check_failure(self,kind):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);shutil.copytree(ROOT/'data',root/'data');m=json.loads((root/'data/catalog-manifest.json').read_text(encoding='utf-8'));p=root/m['packs'][0]['path'];rows=json.loads(p.read_text(encoding='utf-8'))
   if kind=='5999':
    allrows=[]
    for pack in m['packs']:allrows+=json.loads((root/pack['path']).read_text(encoding='utf-8'))
    rows=allrows[:5999];m['packs']=m['packs'][:1];m['expectedCount']=5999
   elif kind=='duplicate':rows[1]=rows[0]
   elif kind=='empty':rows[0]['meaning']=''
   elif kind=='english':rows[0]['meaning']='meaning'
   elif kind=='placeholder':rows[0]['meaning']='번역 필요'
   elif kind=='missing-field':del rows[0]['category']
   elif kind=='source':rows[0]['source']='unknown'
   elif kind=='basic':rows[0].update(id='w:you',word='you',meaning='너')
   elif kind=='missing-file':p.unlink()
   if kind!='missing-file':
    p.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8');m['packs'][0]['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();m['packs'][0]['expectedCount']=len(rows)
   (root/'data/catalog-manifest.json').write_text(json.dumps(m),encoding='utf-8')
   r=subprocess.run([sys.executable,str(ROOT/'scripts/validate-vocabulary.py'),str(root)],capture_output=True)
   self.assertNotEqual(r.returncode,0,kind)
 def test_release_blockers(self):
  for kind in ['5999','duplicate','empty','english','placeholder','missing-field','source','missing-file','basic']:
   with self.subTest(kind=kind):self.check_failure(kind)
if __name__=='__main__':unittest.main()
