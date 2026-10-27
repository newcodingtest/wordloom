import json,re,sys,hashlib,collections,unicodedata
from pathlib import Path
from vocabulary_quality import load_review, validate_meaning
ROOT=Path(__file__).resolve().parents[1]
def validate(root=ROOT):
 m=json.loads((root/'data/catalog-manifest.json').read_text(encoding='utf-8-sig')); words=[]; seen=set(); ids=set()
 review=load_review(root)
 for notice in ['README.md','WORDNET-LICENSE.txt','original/en-ko/ATTRIBUTION','original/en-ko/LICENSE','frequency-README.md','frequency-LICENSE']:
  assert (root/'data/sources'/notice).is_file(), 'Missing license/attribution: '+notice
 for pack in m['packs']:
  p=root/pack['path']; data=p.read_bytes()
  assert hashlib.sha256(data).hexdigest()==pack['sha256'],f'{p}: checksum mismatch'
  entries=json.loads(data); assert len(entries)==pack['expectedCount'],f'{p}: count mismatch'
  for w in entries:
   label=f'{p}: {w.get("id")}'
   assert all(w.get(k) for k in ['id','word','meaning','level','category','source']),label+': missing field'
   lemma=' '.join(unicodedata.normalize('NFKC',w['word']).lower().split())
   assert re.fullmatch(r"[a-z]+(?:[ '-][a-z]+)*",lemma),label+': invalid lemma'
   assert lemma not in m.get('excludedLemmas',[]),label+': excluded basic vocabulary'
   assert w['id']=='w:'+lemma and lemma not in seen and w['id'] not in ids,label+': duplicate/unstable ID'
   assert isinstance(w['meaning'],str) and len(w['meaning'])<=1000 and re.search('[가-힣]',w['meaning']) and not re.search('TODO|미정|번역 필요|뜻 없음|�',w['meaning'],re.I),label+': invalid meaning'
   validate_meaning(w['meaning'],label)
   if lemma in review: assert w['meaning']==review[lemma],label+': editorial correction regression'
   assert type(w['level']) is int and 1<=w['level']<=4,label+': level'
   assert w['source'] in m['sources'],label+': unknown source'
   s=m['sources'][w['source']]; assert s['license']=='CC-BY-SA-4.0' and (root/s['attribution']).is_file(),label+': attribution'
   seen.add(lemma); ids.add(w['id']); words.append(w)
 assert len(words)==m['expectedCount'] and len(seen)>=6000,f'Insufficient vocabulary: {len(seen)} / 6000'
 assert set(review)<=seen, 'Editorial correction targets missing from catalog'
 return words
if __name__=='__main__':
 try:
  words=validate(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT)
  print(json.dumps(dict(result='PASS',raw=len(words),validUnique=len(words),levels=dict(collections.Counter(w['level'] for w in words)),categories=dict(collections.Counter(w['category'] for w in words))),ensure_ascii=False))
 except Exception as e:
  print('FAIL:',e); sys.exit(1)
