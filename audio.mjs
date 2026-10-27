let generation=0,current,timer,sequence=null,utterances=[],sources={};
export function configureAudio(value){sources=value||{};}
function stopCurrent(){generation++;clearTimeout(timer);utterances=[];if(current){const previous=current;current=null;previous.onplaying=previous.onended=previous.onerror=previous.onstalled=null;for(const action of [()=>previous.pause(),()=>previous.removeAttribute('src'),()=>previous.load()])try{action();}catch{}}try{window.speechSynthesis?.cancel();}catch{}}
export function stopAudio(){sequence=null;stopCurrent();}
// WebKit needs a gesture to start speech. Queue all parts in that same gesture;
// hold utterances until completion and never cancel between compound parts.
function systemSequence(texts,rate,id,onStep,onError){
 const token=generation,synth=window.speechSynthesis;
 const fail=message=>{if(token!==generation||sequence!==id)return;stopAudio();onStep(-1);onError(message);};
 if(!synth||!window.SpeechSynthesisUtterance){fail('当前设备没有可用的系统语音，请尝试有道语音。');return;}
 try{const voice=(synth.getVoices?.()||[]).find(v=>String(v.lang).replace('_','-').toLowerCase()==='en-us');
  utterances=texts.map((text,i)=>{const u=new window.SpeechSynthesisUtterance(text);u.lang='en-US';if(voice)u.voice=voice;u.rate=rate;
   u.onstart=()=>{if(token!==generation||sequence!==id)return;clearTimeout(timer);onStep(i);};
   u.onend=()=>{if(token!==generation||sequence!==id)return;clearTimeout(timer);if(i===texts.length-1){sequence=null;utterances=[];onStep(-1);}else timer=setTimeout(()=>fail('系统朗读未继续，请再次点击系统语音。'),6000);};
   u.onerror=()=>fail('系统语音播放失败，请检查设备音量和英语（美国）语音后重试。');return u;});
  onStep(0);timer=setTimeout(()=>fail('系统语音未启动，请检查音量和英语（美国）语音后再次点击系统语音。'),6000);
  for(const u of utterances)synth.speak(u);
 }catch{fail('系统语音无法启动，请点击「系统语音」重试。');}
}
export function speak(text,rate=1,onError=()=>{}){speakSequence([text],rate,()=>{},onError);}
export function speakSequence(texts,rate=1,onStep=()=>{},onError=()=>{},options={}){
 stopAudio();texts=texts.map(t=>String(t).trim()).filter(Boolean);if(!texts.length){onStep(-1);return;}
 const id=sequence=Symbol();
 if(options.source==='system'){systemSequence(texts,rate,id,onStep,onError);return;}
 // Resolve the complete sequence synchronously before play(), including word
 // fallbacks. Never await a fetch before the initial user-activated playback.
 const clips=texts.flatMap((text,part)=>{const e=sources[text];if(e?.unavailable)return [{text,part,system:true}];if(e?.files?.length){if(e.mode==='words')options.onStatus?.('这条表达使用有道逐词朗读。');return e.files.map(url=>({url,text,part}));}return [{text,part,url:'https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(text)+'&type=2'}];});
 let index=0,player;
 const next=()=>{if(sequence!==id)return;if(index>=clips.length){sequence=null;onStep(-1);return;}
  const clip=clips[index++],at=clip.part;if(index===1||clips[index-2].part!==at)onStep(at);const token=generation;let local=false,ended=false;
  const done=()=>{if(token!==generation||ended||sequence!==id)return;ended=true;clearTimeout(timer);next();};
  const fallback=()=>{if(token!==generation||local||ended||sequence!==id)return;local=true;clearTimeout(timer);try{player?.pause();}catch{}options.onStatus?.('有道音频暂不可用，尝试系统语音；无声时请点击系统语音。');systemSequence(texts.slice(at),rate,id,i=>onStep(i<0?-1:at+i),onError);};
  if(clip.system){fallback();return;}
  try{const url=clip.url;
   // Keep the player unlocked by the initial tap for the whole sequence.
   if(!player)player=new Audio(url);else player.src=url;current=player;player.playbackRate=rate;
   player.onplaying=()=>{if(token===generation&&!local)clearTimeout(timer);};player.onended=()=>{if(!local)done();};player.onerror=fallback;
   // A transient stalled event is common on mobile; allow recovery before fallback.
   player.onstalled=()=>{if(token===generation&&!local&&!ended){clearTimeout(timer);timer=setTimeout(fallback,5000);}};timer=setTimeout(fallback,5000);player.play()?.catch(fallback);
  }catch{fallback();}
 };next();
}
