import gzip,struct,re,html,json,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def save(path,obj):
 (ROOT/path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=ROOT/'data/sources/original/en-ko'
idx=(p/'en-ko.idx').read_bytes(); d=gzip.decompress((p/'en-ko.dict.dz').read_bytes())
freq={line.split()[0]:n for n,line in enumerate((ROOT/'data/sources/en_50k.txt').read_text(encoding='utf-8').splitlines(),1)}
rows=[]; i=0; excluded=collections.Counter()
bad=set('fuck fucking shit bullshit bitch bastard asshole cock dick cunt porn pornography nazi nigger faggot'.split())
while i<len(idx):
 end=idx.index(0,i); word=idx[i:end].decode(); offset,size=struct.unpack('>II',idx[end+1:end+9]); i=end+9; raw=d[offset:offset+size].decode()
 if not re.fullmatch('[a-z]{2,24}',word) or word in bad or word not in freq:
  excluded['form/name/frequency']+=1; continue
 if re.search(r'\b(form of|plural of|past participle of|past tense of|alternative spelling of|obsolete|archaic|vulgar|offensive|slur)\b',raw,re.I):
  excluded['inflection/variant/usage']+=1; continue
 meanings=[]
 for m in re.findall(r'<b>(.*?)</b>',raw):
  m=html.unescape(re.sub('<[^>]+>','',m)); m=re.sub(r'\([^)]*\)','',m).strip()
  if re.search('[가-힣]',m) and m not in meanings: meanings.append(m)
 if not meanings: excluded['no Korean']+=1; continue
 pos=re.search(r'<i>([^<]+)</i>',raw)
 rows.append(dict(id='w:'+word,word=word,meaning='; '.join(meanings[:3]),level=1,category='일반 독해',source='koreader-en-ko-v1.2.0',sourceUrl='https://en.wiktionary.org/wiki/'+word,license='CC-BY-SA-4.0',partOfSpeech=pos[1] if pos else '',frequencyRank=freq[word]))
names={w['word'] for w in rows}
remove=set('ab ar el em en ex fa ko la li mi mu nu om ou re se si xi ass colored dicks tits statues pussy juvie'.split())
filtered=[]
for w in rows:
 word=w['word']
 stems=[]
 if word.endswith('ed'): stems=[word[:-2],word[:-1],word[:-3] if len(word)>4 and word[-3]==word[-4] else '']
 if word.endswith('ing'): stems=[word[:-3],word[:-3]+'e',word[:-4] if len(word)>5 and word[-4]==word[-5] else '']
 if word in remove or any(stem in names for stem in stems): excluded['conservative morphology/curation']+=1; continue
 filtered.append(w)
exclusion_policy=json.loads((ROOT/'data/sources/basic-exclusions.json').read_text(encoding='utf-8-sig'))
basic_exclusions=set(' '.join(exclusion_policy['groups'].values()).split())
basic_removed=[w['word'] for w in filtered if w['word'] in basic_exclusions]
rows=[w for w in filtered if w['word'] not in basic_exclusions]
excluded['basic vocabulary policy']=len(basic_removed)
corrections=json.loads((ROOT/'data/sources/corrections.json').read_text(encoding='utf-8-sig'))
for w in rows:
 if w['word'] in corrections: w['meaning']=corrections[w['word']]
rows.sort(key=lambda w:(w['frequencyRank'],w['word'])); rows=rows[:6500]
for n,w in enumerate(rows):
 w['level']=1 if n<1000 else 2 if n<2500 else 3 if n<4500 else 4
 if w['partOfSpeech']=='v.': w['category']='행동과 과정'
 elif w['partOfSpeech'] in ['adj.','adv.']: w['category']='성질과 관계'
rows.sort(key=lambda w:w['word']); packs=[]
for n in range(0,len(rows),500):
 path=f'data/packs/core-{n//500+1:02}.json'; save(path,rows[n:n+500]); packs.append(dict(path=path,expectedCount=len(rows[n:n+500]),sha256=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()))
save('data/catalog-manifest.json',dict(schemaVersion=1,catalogVersion='2026.10.26.2',excludedLemmas=sorted(basic_exclusions),minValidUniqueWords=6000,expectedCount=len(rows),sources={'koreader-en-ko-v1.2.0':{'license':'CC-BY-SA-4.0','attribution':'data/sources/README.md'}},packs=packs))
save('data/sources/conversion-report.json',dict(selected=len(rows),basicRemoved=sorted(basic_removed),excluded=excluded,archiveSHA256=hashlib.sha256((ROOT/'data/sources/en-ko.zip').read_bytes()).hexdigest(),levels=dict(collections.Counter(w['level'] for w in rows)),categories=dict(collections.Counter(w['category'] for w in rows))))
samples=[]
for level in range(1,5):
 for category in sorted(set(x['category'] for x in rows)):
  group=[x for x in rows if x['level']==level and x['category']==category]; samples.extend(group[::max(1,len(group)//8)][:8])
save('data/sources/qa-sample.json',samples)
print('Selected',len(rows),'unique headwords; excluded',dict(excluded))

