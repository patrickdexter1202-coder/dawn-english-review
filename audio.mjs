let generation=0,current,timer,sequence=null,utterances=[];
function stopCurrent(){generation++;clearTimeout(timer);utterances=[];if(current){const previous=current;current=null;previous.onplaying=previous.onended=previous.onerror=previous.onstalled=null;for(const action of [()=>previous.pause(),()=>previous.removeAttribute('src'),()=>previous.load()])try{action();}catch{}}try{window.speechSynthesis?.cancel();}catch{}}
export function stopAudio(){sequence=null;stopCurrent();}
function isAppleMobile(){const n=globalThis.navigator;return /iPad|iPhone|iPod/.test(n?.userAgent||'')||(/Mac/.test(n?.platform||'')&&n?.maxTouchPoints>1);}
// WebKit needs a gesture to start speech. Queue all parts in that same gesture;
// hold utterances until completion and never cancel between compound parts.
function systemSequence(texts,rate,id,onStep,onError){
 const token=generation,synth=window.speechSynthesis;
 const fail=message=>{if(token!==generation||sequence!==id)return;stopAudio();onStep(-1);onError(message);};
 if(!synth||!window.SpeechSynthesisUtterance){fail('当前设备没有可用的系统语音，请尝试普通朗读。');return;}
 try{const voice=(synth.getVoices?.()||[]).find(v=>String(v.lang).replace('_','-').toLowerCase()==='en-us');
  utterances=texts.map((text,i)=>{const u=new window.SpeechSynthesisUtterance(text);u.lang='en-US';if(voice)u.voice=voice;u.rate=rate;
   u.onstart=()=>{if(token!==generation||sequence!==id)return;clearTimeout(timer);onStep(i);};
   u.onend=()=>{if(token!==generation||sequence!==id)return;clearTimeout(timer);if(i===texts.length-1){sequence=null;utterances=[];onStep(-1);}else timer=setTimeout(()=>fail('系统朗读未继续，请再次点击备用朗读。'),6000);};
   u.onerror=()=>fail('系统语音播放失败，请检查设备音量和英语（美国）语音后重试。');return u;});
  onStep(0);timer=setTimeout(()=>fail('系统语音未启动，请检查音量和英语（美国）语音后再次点击朗读。'),6000);
  for(const u of utterances)synth.speak(u);
 }catch{fail('系统语音无法启动，请再次点击朗读。');}
}
export function speak(text,rate=1,onError=()=>{}){speakSequence([text],rate,()=>{},onError);}
export function speakSequence(texts,rate=1,onStep=()=>{},onError=()=>{},options={}){
 stopAudio();texts=texts.map(t=>String(t).trim()).filter(Boolean);if(!texts.length){onStep(-1);return;}
 const id=sequence=Symbol();
 if(options.source==='system'||(options.source!=='online'&&isAppleMobile()&&window.speechSynthesis&&window.SpeechSynthesisUtterance)){systemSequence(texts,rate,id,onStep,onError);return;}
 let index=0,player;
 const next=()=>{if(sequence!==id)return;if(index>=texts.length){sequence=null;onStep(-1);return;}
  const at=index++;onStep(at);const token=generation;let local=false,ended=false;
  const done=()=>{if(token!==generation||ended||sequence!==id)return;ended=true;clearTimeout(timer);next();};
  const fallback=()=>{if(token!==generation||local||sequence!==id)return;local=true;clearTimeout(timer);try{player?.pause();}catch{}systemSequence(texts.slice(at),rate,id,i=>onStep(i<0?-1:at+i),onError);};
  try{const url='https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(texts[at])+'&type=2';
   // Keep the player unlocked by the initial tap for the whole sequence.
   if(!player)player=new Audio(url);else player.src=url;current=player;player.playbackRate=rate;
   player.onplaying=()=>{if(token===generation&&!local)clearTimeout(timer);};player.onended=()=>{if(!local)done();};player.onerror=fallback;player.onstalled=fallback;timer=setTimeout(fallback,3500);player.play()?.catch(fallback);
  }catch{fallback();}
 };next();
}
