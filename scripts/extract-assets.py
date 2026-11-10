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
SHEETS={'run':'Sprites/Diana/diana-run.png','idle':'Sprites/Diana/diana-idle.png','air':'Sprites/Diana/diana-airbourne.png','dash':'Sprites/Diana/diana-lateral-dash.png','bodyDash':'Sprites/Diana/No Cape/no-cape-diana-lateral-dash.png','drop':'Sprites/Diana/diana-drop-roll.png','jumpLanding':'Sprites/Diana/diana-jump-hard-landing.png','softLanding':'Sprites/Diana/diana-soft-landing.png','startStop':'Sprites/Diana/diana-start-stop.png','undercape':'Sprites/Diana/undercape-diana-lateral-dash.png','sprout':'Sprites/Diana/title-diana-leaves.png','star':'Sprites/Star/star-collectibles.png','title':'Sprites/Background/fulltitle.png','saturn':'Sprites/Environment/saturn-transparent.png','background':'Sprites/Star/bg-stars.png','portal':'Sprites/Environment/portal.png','logo':'Sprites/Background/title.png','titleground':'Sprites/Background/titleground.png','cadent1':'Sprites/Star/cadent1.png','cadent2':'Sprites/Star/cadent2.png','tailStar':'Sprites/Star/tail-star.png',
 # Level I has no cape (RESEARCH_PROGRESSION 2.1): the original no-cape sheets
 # behind the no-cape-diana override controller. bodyDash above is already the
 # no-cape lateral dash, so nocape-dash reuses it.
 'nocapeRun':'Sprites/Diana/No Cape/no-cape-diana-run.png','nocapeIdle':'Sprites/Diana/No Cape/no-cape-diana-idle.png',
 'nocapeAir':'Sprites/Diana/No Cape/no-cape-diana-airbourne.png','nocapeDrop':'Sprites/Diana/No Cape/no-cape-diana-drop.png',
 'nocapeJumpLanding':'Sprites/Diana/No Cape/no-cape-diana-jump-hard-landing.png','nocapeSoftLanding':'Sprites/Diana/No Cape/no-cape-diana-soft-landing.png',
 'nocapeStartStop':'Sprites/Diana/No Cape/no-cape-diana-start-stop.png',
 # The original HUD's cape meter (RESEARCH_PROGRESSION 3.3): single sprites
 # (spriteMode 1, no slices), drawn by style.css, not on the canvas.
 'breathDisc':'Sprites/UI/DianaCooldownCircle.png','breathFrame':'Sprites/UI/barrinha.png',
 'breathFill':'Sprites/UI/recheioBarra.png','meteor':'Sprites/UI/meteoroCheio.png'}
# HUD-only sheets: game.js warms them for the CSS instead of decoding them for the canvas.
HUD={'breathDisc','breathFrame','breathFill','meteor'}
CLIPS={'run':'running','idle':'idle','air':'airbourne','dash':'dash-lateral','cape':'capedash','dive':'drop-roll','jump':'jump-1','softLanding':'soft-landing','hardLanding':'hard-landing','start':'start','stop':'stopping','sprout':'sprout','cadent1':'../stars/cadent1','cadent2':'../stars/cadent2',
 # The no-cape override clips (Animations/Diana/No Cape/*.anim), named after
 # the model's animation states they replace (animation.mjs NOCAPE_CLIPS).
 'nocapeRun':'No Cape/nocape-running','nocapeIdle':'No Cape/nocape-idle','nocapeAir':'No Cape/nocape-airbourne',
 'nocapeDash':'No Cape/nocape-dash','nocapeDive':'No Cape/nocape-drop-roll','nocapeJump':'No Cape/nocape-jump1',
 'nocapeSoftLanding':'No Cape/nocape-soft-landing','nocapeHardLanding':'No Cape/nocape-hard-landing',
 'nocapeStart':'No Cape/nocape-start','nocapeStop':'No Cape/nocape-stop'}
# Original sound effects, copied byte-for-byte (Resources/Audio). The demo plays
# these instead of synthesized chimes; star.wav is pitch-stepped for melodies.
SFX={'jump':'Jump.wav','dash':'Dash.wav','star':'star.wav','death':'death.wav','success':'successLevel.wav','select':'select.wav'}
manifest={};lookup={}
with ZipFile(ARCHIVE) as z:
 for key,src in SHEETS.items():
  raw=z.read(BASE+src);(OUT/f'{key}.png').write_bytes(raw)
  w,h=struct.unpack('>II',raw[16:24]);meta=z.read(BASE+src+'.meta').decode('utf8');frames=[];guid=re.search(r'^guid: ([0-9a-f]+)',meta,re.M).group(1)
  body=meta.split('    sprites:')[-1].split('    outline:')[0] if '    sprites: []' in meta else meta.split('    sprites:')[-1]
  for b in body.split('    - serializedVersion: 2')[1:]:
   m=re.search(r'      rect:\s*\n        serializedVersion: \d+\s*\n        x: ([\d.]+)\s*\n        y: ([\d.]+)\s*\n        width: ([\d.]+)\s*\n        height: ([\d.]+)',b)
   if not m: continue
   x,y,fw,fh=map(float,m.groups());alignment=int(re.search(r'      alignment: (\d+)',b).group(1));pivot=re.search(r'      pivot: \{x: ([-\d.]+), y: ([-\d.]+)\}',b)
   px,py=map(float,pivot.groups()) if alignment==9 else (.5,.5)
   fid=re.search(r'      internalID: ([-\d]+)',b).group(1)
   frames.append({'x':x,'y':h-y-fh,'w':fw,'h':fh,'pivotX':px,'pivotY':py,'sourceID':fid})
   lookup[fid]={'sheet':key,'frame':len(frames)-1,'guid':guid}
  manifest[key]={'file':f'assets/{key}.png','source':src,'width':w,'height':h,'frames':frames,**({'hud':True} if key in HUD else {})}
 for key,src in CLIPS.items():
  path=BASE+'Animations/'+('Diana/'+src if not src.startswith('../') else src[3:])+'.anim';s=z.read(path).decode('utf8');curve=s.split('  m_PPtrCurves:')[-1].split('    attribute:')[0]
  values=[]
  for t,fid,guid in re.findall(r'    - time: ([\d.]+)\s*\n      value: \{fileID: ([-\d]+), guid: ([0-9a-f]+)',curve):
   # Sprite fileIDs are unique across the archive's sheets; the guid check
   # proves the clip names the same sheet (the no-cape clips name their own).
   if fid not in lookup or lookup[fid]['guid']!=guid: raise ValueError(f'Unresolved sprite {fid} ({guid}) in {src}')
   values.append({'time':float(t),'sheet':lookup[fid]['sheet'],'frame':lookup[fid]['frame']})
  fps=float(re.search(r'  m_SampleRate: ([\d.]+)',s).group(1));loop=bool(int(re.search(r'    m_LoopTime: (\d+)',s).group(1)))
  manifest.setdefault('animations',{})[key]={'source':path[len(BASE):],'frames':values,'duration':values[-1]['time']+1/fps,'fps':fps,'loop':loop}
 manifest['music']={'file':'assets/soundtrack.mp3','source':'Resources/Audio/soundtrack2.mp3'}
 (OUT/'soundtrack.mp3').write_bytes(z.read(BASE+manifest['music']['source']))
 (OUT/'solarum.ttf').write_bytes(z.read(BASE+'Fonts/Solarum-Regular.ttf'))
 (OUT/'sfx').mkdir(exist_ok=True)
 for key,src in SFX.items():
  (OUT/'sfx'/f'{key}.wav').write_bytes(z.read(BASE+'Resources/Audio/'+src))
  manifest.setdefault('sfx',{})[key]={'file':f'assets/sfx/{key}.wav','source':'Resources/Audio/'+src,'use':'archive only: provenance for the original Unity effect; not loaded and not in the itch ZIP'}
# Which retained files are actually drawn or played (the rest stay as an archive).
manifest['usage']={
 'onScreen':{
  'run':'Diana running','idle':'Diana at rest after the victory stop, and rising out of the soil on the wake','air':'Diana airborne','dash':'cape layer during flight',
  'bodyDash':'no-cape body under the flight cape','drop':'dive roll','jumpLanding':'takeoff and hard landing','softLanding':'soft landing',
  'startStop':'wake / respawn start and the victory stop','sprout':'title sprout (Diana hidden in the soil), the leaves that twitch as she emerges, and the respawn pop',
  'star':"pickups, constellations, Great Stars, HUD slots, beacon tops, death shards, refill bursts; I's falling shower stars and the brightest star's core, the locks' stars, glints, the helper and II's eye light",'background':'twinkling sky stars',
  'saturn':'very faint distant planet','portal':'the far door (visible-alpha crop)','logo':'title logo','titleground':'title ground and tinted back hills',
  'cadent1':'occasional shooting star','cadent2':'occasional shooting star','tailStar':"updraft wind streaks and Great Star tails; the streaks of I's falling stars, of the asteroid's fall, of the helper and of II's eye light",
  'font':'assets/solarum.ttf for every label','music':'soundtrack after the wake gesture',
  'sound':'every effect is synthesised in audio.mjs (D major, the soundtrack key); no sample files are loaded',
  'nocapeRun':'Diana running before the cape is hers (a level whose verbs lack the cape)','nocapeIdle':'no-cape rest and the no-cape emergence from the soil',
  'nocapeAir':'no-cape airborne','nocapeDrop':'no-cape dive roll (only if a level grants the dive before the cape)',
  'nocapeJumpLanding':'no-cape takeoff and hard landing','nocapeSoftLanding':'no-cape soft landing','nocapeStartStop':'no-cape wake / respawn start and victory stop',
  'breathDisc':'HUD breath bar: the disc at the bar\'s left end while the cape is charging','breathFrame':'HUD breath bar: the hand-drawn frame',
  'breathFill':'HUD breath bar: the fill, clipped to the cape\'s charge','meteor':"HUD breath bar: the disc once the cape is full (the gift is ready), with one ring pulse; also the world's asteroid: the head of its fall in I, half buried under I's dust plume beyond the door, and in II's crater, where it opens its eye"},
 'archiveOnly':{
  'title':'fulltitle composition; the title is rebuilt from its own logo and ground layers so the sprout can animate',
  'undercape':'no original clip references it',
  'jump-landing.png':'byte-identical duplicate of jumpLanding.png left by an earlier pass; not referenced and excluded from the itch ZIP',
  'sfx':'assets/sfx/*.wav (Jump, Dash, star, death, successLevel, select): kept for provenance; replaced by procedural cues and excluded from the itch ZIP',
  'No Cape/running.anim':'a stray copy of nocape-running.anim in the sprite folder (not referenced by the override controller); not extracted'},
 # Original art drawn with a new meaning: what the original meant is recorded, and not used.
 'meaningsNotUsed':{
  'meteor':'In the original HUD the full meteor marked the star quota (a flight cost collected stars). Here it only means "the cape is full"; stars never gate a flight (RESEARCH_PROGRESSION 3.1, C4)',
  'breathDisc':'DianaCooldownCircle was the original cooldown timer disc; the bar now fills by running (breath), not by a timer'}}
# Alpha/luminance analysis of the unchanged original portal: no padding in its contact rectangle.
manifest['portal']['visibleBounds']={'x':1,'y':0,'w':243,'h':392}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for key,c in manifest['animations'].items():print(key,len(c['frames']),c['duration'],'loop',c['loop'])
