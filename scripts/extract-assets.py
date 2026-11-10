"""Copy unchanged original art and translate Unity sprite + clip metadata.
Run from this directory or the workspace. No image processing/re-encoding occurs.
"""
from pathlib import Path
from zipfile import ZipFile
import re, json, struct
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT.parent/'refs'/'solarum'/'solarum-master.zip'  # original Unity archive kept in the workspace refs/ folder
OUT=ROOT/'assets'
BASE='solarum-master/solarum/Assets/'
SHEETS={'run':'Sprites/Diana/diana-run.png','idle':'Sprites/Diana/diana-idle.png','air':'Sprites/Diana/diana-airbourne.png','dash':'Sprites/Diana/diana-lateral-dash.png','bodyDash':'Sprites/Diana/No Cape/no-cape-diana-lateral-dash.png','drop':'Sprites/Diana/diana-drop-roll.png','jumpLanding':'Sprites/Diana/diana-jump-hard-landing.png','softLanding':'Sprites/Diana/diana-soft-landing.png','startStop':'Sprites/Diana/diana-start-stop.png','undercape':'Sprites/Diana/undercape-diana-lateral-dash.png','sprout':'Sprites/Diana/title-diana-leaves.png','star':'Sprites/Star/star-collectibles.png','title':'Sprites/Background/fulltitle.png','saturn':'Sprites/Environment/saturn-transparent.png','background':'Sprites/Star/bg-stars.png','portal':'Sprites/Environment/portal.png','logo':'Sprites/Background/title.png','titleground':'Sprites/Background/titleground.png','cadent1':'Sprites/Star/cadent1.png','cadent2':'Sprites/Star/cadent2.png','tailStar':'Sprites/Star/tail-star.png'}
CLIPS={'run':'running','idle':'idle','air':'airbourne','dash':'dash-lateral','cape':'capedash','dive':'drop-roll','jump':'jump-1','softLanding':'soft-landing','hardLanding':'hard-landing','start':'start','stop':'stopping','sprout':'sprout','cadent1':'../stars/cadent1','cadent2':'../stars/cadent2'}
# Original sound effects, copied byte-for-byte (Resources/Audio). The demo plays
# these instead of synthesized chimes; star.wav is pitch-stepped for melodies.
SFX={'jump':'Jump.wav','dash':'Dash.wav','star':'star.wav','death':'death.wav','success':'successLevel.wav','select':'select.wav'}
manifest={};lookup={}
with ZipFile(ARCHIVE) as z:
 for key,src in SHEETS.items():
  raw=z.read(BASE+src);(OUT/f'{key}.png').write_bytes(raw)
  w,h=struct.unpack('>II',raw[16:24]);meta=z.read(BASE+src+'.meta').decode('utf8');frames=[]
  body=meta.split('    sprites:')[-1].split('    outline:')[0] if '    sprites: []' in meta else meta.split('    sprites:')[-1]
  for b in body.split('    - serializedVersion: 2')[1:]:
   m=re.search(r'      rect:\s*\n        serializedVersion: \d+\s*\n        x: ([\d.]+)\s*\n        y: ([\d.]+)\s*\n        width: ([\d.]+)\s*\n        height: ([\d.]+)',b)
   if not m: continue
   x,y,fw,fh=map(float,m.groups());alignment=int(re.search(r'      alignment: (\d+)',b).group(1));pivot=re.search(r'      pivot: \{x: ([-\d.]+), y: ([-\d.]+)\}',b)
   px,py=map(float,pivot.groups()) if alignment==9 else (.5,.5)
   fid=re.search(r'      internalID: ([-\d]+)',b).group(1)
   frames.append({'x':x,'y':h-y-fh,'w':fw,'h':fh,'pivotX':px,'pivotY':py,'sourceID':fid})
   lookup[fid]={'sheet':key,'frame':len(frames)-1}
  manifest[key]={'file':f'assets/{key}.png','source':src,'width':w,'height':h,'frames':frames}
 for key,src in CLIPS.items():
  path=BASE+'Animations/'+('Diana/'+src if not src.startswith('../') else src[3:])+'.anim';s=z.read(path).decode('utf8');curve=s.split('  m_PPtrCurves:')[-1].split('    attribute:')[0]
  values=[]
  for t,fid in re.findall(r'    - time: ([\d.]+)\s*\n      value: \{fileID: ([-\d]+), guid:',curve):
   if fid not in lookup: raise ValueError(f'Unresolved sprite {fid} in {src}')
   values.append({'time':float(t),**lookup[fid]})
  fps=float(re.search(r'  m_SampleRate: ([\d.]+)',s).group(1));loop=bool(int(re.search(r'    m_LoopTime: (\d+)',s).group(1)))
  manifest.setdefault('animations',{})[key]={'source':path[len(BASE):],'frames':values,'duration':values[-1]['time']+1/fps,'fps':fps,'loop':loop}
 manifest['music']={'file':'assets/soundtrack.mp3','source':'Resources/Audio/soundtrack2.mp3'}
 (OUT/'soundtrack.mp3').write_bytes(z.read(BASE+manifest['music']['source']))
 (OUT/'solarum.ttf').write_bytes(z.read(BASE+'Fonts/Solarum-Regular.ttf'))
 (OUT/'sfx').mkdir(exist_ok=True)
 for key,src in SFX.items():
  (OUT/'sfx'/f'{key}.wav').write_bytes(z.read(BASE+'Resources/Audio/'+src))
  manifest.setdefault('sfx',{})[key]={'file':f'assets/sfx/{key}.wav','source':'Resources/Audio/'+src}
# Which retained files are actually drawn or played (the rest stay as an archive).
manifest['usage']={
 'onScreen':{
  'run':'Diana running','idle':'Diana at rest after the victory stop, and rising out of the soil on the wake','air':'Diana airborne','dash':'cape layer during flight',
  'bodyDash':'no-cape body under the flight cape','drop':'dive roll','jumpLanding':'takeoff and hard landing','softLanding':'soft landing',
  'startStop':'wake / respawn start and the victory stop','sprout':'title sprout (Diana hidden in the soil), the leaves that twitch as she emerges, and the respawn pop',
  'star':'pickups, constellations, Great Stars, HUD slots, beacon tops, death shards, refill bursts','background':'twinkling sky stars',
  'saturn':'very faint distant planet','portal':'the far door (visible-alpha crop)','logo':'title logo','titleground':'title ground and tinted back hills',
  'cadent1':'occasional shooting star','cadent2':'occasional shooting star','tailStar':'updraft wind streaks and Great Star tails',
  'font':'assets/solarum.ttf for every label','music':'soundtrack after the wake gesture','sfx':'jump, dash, star (pitched for melodies), death, success, select'},
 'archiveOnly':{
  'title':'fulltitle composition; the title is rebuilt from its own logo and ground layers so the sprout can animate',
  'undercape':'no original clip references it',
  'jump-landing.png':'byte-identical duplicate of jumpLanding.png left by an earlier pass; not referenced and excluded from the itch ZIP'}}
# Alpha/luminance analysis of the unchanged original portal: no padding in its contact rectangle.
manifest['portal']['visibleBounds']={'x':1,'y':0,'w':243,'h':392}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for key,c in manifest['animations'].items():print(key,len(c['frames']),c['duration'],'loop',c['loop'])
