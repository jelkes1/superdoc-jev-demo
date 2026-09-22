"""Original instrumental composition, CC0-1.0. Deterministic, no samples or dependencies."""
import math, random, wave, struct
from pathlib import Path
SR=44100; DUR=25; beat=60/96; random.seed(20260922)
samples=[0.0]*int(SR*DUR)
def note(freq,start,duration,gain,kind='pad'):
    begin=int(start*SR); length=min(int(duration*SR),len(samples)-begin)
    for i in range(max(0,length)):
        t=i/SR
        if kind=='pad':
            env=min(t/.32,1)*min((duration-t)/.55,1)
            sound=math.sin(2*math.pi*freq*t)+.16*math.sin(2*math.pi*freq*2*t)
        elif kind=='pluck':
            env=(1-math.exp(-t*130))*math.exp(-t*4)
            sound=math.sin(2*math.pi*freq*t)+.12*math.sin(2*math.pi*freq*3*t)
        else:
            env=(1-math.exp(-t*40))*math.exp(-t*2)
            sound=math.sin(2*math.pi*freq*t)
        samples[begin+i]+=gain*env*sound
# E minor, C major, G major, D major: restrained two-bar chords.
chords=[[52,55,59],[48,52,55],[43,50,55],[50,54,57]]
for bar in range(10):
    chord=chords[(bar//2)%4];start=bar*4*beat
    for midi in chord: note(440*2**((midi-69)/12),start,4*beat+.35,.034)
    for b in (0,2):note(440*2**((chord[0]-12-69)/12),start+b*beat,beat*1.5,.052,'bass')
    for n in range(4):
        midi=chord[(n+bar)%3]+12
        note(440*2**((midi-69)/12),start+n*beat+beat/2,1.1,.027,'pluck')
# Tiny filtered noise ticks, no dramatic impact or distracting percussion.
for n in range(int(DUR/beat)):
    start=int((n*beat)*SR)
    for j in range(int(.045*SR)):
        if start+j<len(samples):samples[start+j]+=(random.random()*2-1)*.008*math.exp(-j/(.008*SR))
peak=max(abs(x) for x in samples);data=bytearray()
for i,x in enumerate(samples):
    t=i/SR;fade=min(1,t/1.0,(DUR-t)/1.6)
    data.extend(struct.pack('<h',round(x/peak*.36*max(0,fade)*32767)))
out=Path('outputs/roi-film/audio');out.mkdir(parents=True,exist_ok=True)
with wave.open(str(out/'superdoc-instrumental.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(data)
print('Original 25-second instrumental rendered.')
