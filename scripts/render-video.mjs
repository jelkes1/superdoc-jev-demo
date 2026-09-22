/** FFmpeg with the subtitles filter is required. Only consumes record-live output. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const out=resolve(process.env.VIDEO_OUTPUT_DIR||'outputs/video');
const timeline=JSON.parse(await readFile(join(out,'timeline.json'),'utf8'));
if(!timeline.measured.some(x=>x.type==='complete'))throw new Error('No measured live review. Refusing to generate launch videos.');
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';await mkdir(out,{recursive:true});
function clock(t){const ms=Math.floor(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
function escapeFilter(path){return path.replaceAll('\\','\\\\').replaceAll(':','\\:').replaceAll("'","'\\''");}
async function render(name,shots,target){
 const fixed=shots.filter(s=>!s.wait).reduce((n,s)=>n+s.end-s.start,0);const waits=shots.filter(s=>s.wait).length;const waitLength=waits?Math.max(2,(target-fixed)/waits):0;
 const segments=shots.map(s=>({...s,duration:s.wait?Math.min(s.end-s.start,waitLength):s.end-s.start}));
 let cursor=0;const captions=[];const filter=[];
 for(const [i,s] of segments.entries()){const raw=s.end-s.start,rate=s.duration/raw;filter.push(`[0:v]trim=start=${s.start}:end=${s.end},setpts=${rate.toFixed(8)}*(PTS-STARTPTS),fps=30[v${i}]`);captions.push(`${i+1}\n${clock(cursor)} --> ${clock(cursor+s.duration)}\n${s.caption}${rate<.999?' [Waiting time compressed]':''}\n`);cursor+=s.duration;}
 // Social selection may be shorter than its target; hold its closing frame.
 const pad=Math.max(0,target-cursor);if(pad)captions[captions.length-1]=captions[captions.length-1].replace(clock(cursor),clock(cursor+pad));
 const subtitle=join(out,`${name}.srt`);await writeFile(subtitle,captions.join('\n'));
 filter.push(segments.map((_,i)=>`[v${i}]`).join('')+`concat=n=${segments.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=${pad},subtitles=filename='${escapeFilter(subtitle)}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H001A2C42,BorderStyle=3,Outline=8,Shadow=0,MarginV=26'[out]`);
 const result=spawnSync(ffmpeg,['-y','-i',timeline.raw,'-filter_complex',filter.join(';'),'-map','[out]','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',join(out,`${name}.mp4`)],{stdio:'inherit'});if(result.status!==0)throw new Error('Video encoding failed. Install FFmpeg with subtitles support or set FFMPEG_PATH.');
 return cursor+pad;
}
const full=await render('superdoc-jev-demo',timeline.shots,75);if(full<60||full>90)throw new Error(`Main cut is ${full.toFixed(1)}s. Adjust timeline pauses before release.`);
const social=await render('superdoc-jev-social',[timeline.shots[0],timeline.shots[1],timeline.shots[2],timeline.shots[3],timeline.shots.at(-1)],25);if(social<20||social>30)throw new Error('Social cut is outside requested duration.');
await writeFile(join(out,'measured-run.json'),JSON.stringify({origin:timeline.origin,browser:timeline.browser,runs:timeline.measured,mainSeconds:full,socialSeconds:social,reviewWaitsCompressed:true},null,2));
console.log('Both captioned MP4 cuts are ready for visual inspection.');
