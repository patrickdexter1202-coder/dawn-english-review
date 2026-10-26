let generation=0,current,timer,sequence=null;
function stopCurrent(){generation++;clearTimeout(timer);if(current){current.pause();current.removeAttribute('src');current.load();current=null;}window.speechSynthesis?.cancel();}
export function stopAudio(){sequence=null;stopCurrent();}
function play(text,rate,onEnd,onError){stopCurrent();const token=generation;let local=false,ended=false;
 const done=()=>{if(token!==generation||ended)return;ended=true;clearTimeout(timer);onEnd();};
 const error=message=>{if(token!==generation||ended)return;ended=true;clearTimeout(timer);onError(message);};
 const fallback=()=>{if(token!==generation||local)return;local=true;clearTimeout(timer);current?.pause();if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){error('当前设备无法朗读，请检查系统语音。');return;}const u=new window.SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=rate;u.onend=done;u.onerror=()=>error('系统语音播放失败。');window.speechSynthesis.speak(u);};
 current=new Audio('https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(text)+'&type=1');current.playbackRate=rate;current.onplaying=()=>{if(token===generation)clearTimeout(timer);};current.onended=()=>{if(!local)done();};current.onerror=fallback;current.onstalled=fallback;timer=setTimeout(fallback,3500);current.play().catch(fallback);
}
export function speak(text,rate=1,onError=()=>{}){stopAudio();play(text,rate,()=>{},onError);}
export function speakSequence(texts,rate=1,onStep=()=>{},onError=()=>{}){stopAudio();const id=sequence=Symbol();let index=0;const next=()=>{if(sequence!==id)return;if(index>=texts.length){sequence=null;onStep(-1);return;}const at=index++;onStep(at);play(texts[at],rate,next,message=>{if(sequence===id){sequence=null;onStep(-1);onError(message);}});};next();}
