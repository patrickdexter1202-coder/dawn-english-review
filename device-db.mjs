let handle,opening,unavailableUntil=0;
const DEADLINE=1500,JOURNAL='dawn-review-journal-v1';
let status={mode:'indexeddb',message:''};
const memory={attempts:new Map(),sessions:new Map()};
function readJournal(){try{const raw=globalThis.localStorage?.getItem(JOURNAL);if(raw){const value=JSON.parse(raw);for(const name of ['attempts','sessions'])for(const row of value[name]||[])if(row?.id&&!memory[name].has(row.id))memory[name].set(row.id,row);}}catch{}}
readJournal();
function flushJournal(){try{if(!globalThis.localStorage)throw new Error('unavailable');globalThis.localStorage.setItem(JOURNAL,JSON.stringify({attempts:[...memory.attempts.values()],sessions:[...memory.sessions.values()]}));return true;}catch{return false;}}
function checkpoint(rows){for(const name of ['attempts','sessions'])for(const row of rows[name]||[])memory[name].set(row.id,row);return flushJournal();}
function acknowledge(rows){for(const name of ['attempts','sessions'])for(const row of rows[name]||[])if(JSON.stringify(memory[name].get(row.id))===JSON.stringify(row))memory[name].delete(row.id);flushJournal();}
function failed(message){status={mode:'fallback',message:message||'学习记录正使用本机备用存储，可继续复习并导出备份。'};unavailableUntil=Date.now()+30000;try{handle?.close();}catch{}handle=null;}
export function storageStatus(){return {...status};}
async function db(){
 if(handle)return handle;if(Date.now()<unavailableUntil)throw new Error('本机主存储暂不可用');if(opening)return opening;
 opening=new Promise((resolve,reject)=>{let settled=false,request;const end=(error,value)=>{if(settled){if(value)try{value.close();}catch{}return;}settled=true;clearTimeout(timer);if(error){failed();reject(error);}else{handle=value;value.onversionchange=()=>{value.close();handle=null;};resolve(value);}};const timer=setTimeout(()=>end(new Error('学习记录存储响应超时')),DEADLINE);
  try{request=globalThis.indexedDB.open('dawn-review-learning-v1',2);request.onupgradeneeded=()=>{for(const name of ['attempts','sessions'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};request.onsuccess=()=>end(null,request.result);request.onerror=()=>end(new Error('学习记录存储无法打开'));request.onblocked=()=>end(new Error('旧页面占用了学习记录存储'));}catch(e){end(e);}
 }).finally(()=>{opening=null;});return opening;
}
async function transaction(names,mode,work){const d=await db();return new Promise((resolve,reject)=>{let t,settled=false,value;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){failed();reject(error);}else resolve(value);};const timer=setTimeout(()=>{try{t?.abort();}catch{}finish(new Error('学习记录存储响应超时'));},DEADLINE);try{t=d.transaction(names,mode);t.oncomplete=()=>finish();t.onerror=()=>finish(new Error('学习记录保存失败'));t.onabort=()=>finish(new Error('学习记录存储已中断'));work(t,v=>{value=v;});}catch(e){try{t?.abort();}catch{}finish(e);}});}
async function read(name,field){let rows=[];try{rows=await transaction([name],'readonly',(t,set)=>{const r=t.objectStore(name).getAll();r.onsuccess=()=>set(r.result);});}catch{failed();}readJournal();const map=new Map(rows.map(row=>[row.id,row]));for(const [id,row]of memory[name])map.set(id,row);return [...map.values()].sort((a,b)=>String(a[field]||'').localeCompare(String(b[field]||'')));}
async function write(rows){const backup=checkpoint(rows);try{await transaction(Object.keys(rows),'readwrite',t=>{for(const [name,values]of Object.entries(rows))for(const row of values)t.objectStore(name).put(row);});acknowledge(rows);}catch{failed();if(!backup){status={mode:'memory',message:'浏览器无法保存学习记录，当前记录暂留本页，请导出学习备份。'};throw new Error(status.message);}}}
export function attempts(){return read('attempts','at');}
export function sessions(){return read('sessions','startedAt');}
export function saveSession(value){return write({sessions:[value]});}
export function saveProgress(attempt,session){return write({attempts:[attempt],sessions:[session]});}
export function saveAttempt(value){return write({attempts:[value]});}
function validateAttempts(list){if(!Array.isArray(list)||list.length>100000||list.some(a=>!a?.id||!a.questionId||!a.at||typeof a.correct!=='boolean'))throw new Error('学习备份格式无效');}
export async function restoreAttempts(list){validateAttempts(list);await write({attempts:list});}
export async function restoreLearning(backup){if(!['1.0.0','1.1.0'].includes(backup?.schemaVersion))throw new Error('备份版本不支持');validateAttempts(backup.attempts);const list=backup.sessions||[];if(!Array.isArray(list)||list.length>100000||list.some(s=>!s?.id||!s.startedAt||!Number.isInteger(s.planned)||!Number.isInteger(s.completed)))throw new Error('本轮记录格式无效');await write({attempts:backup.attempts,sessions:list});}
export function download(value,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
