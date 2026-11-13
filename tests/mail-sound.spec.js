const {test,expect}=require('@playwright/test');
const ts=require('typescript'),fs=require('fs');
function sound(state='running'){
 const tones=[];
 class AudioContext{
  constructor(){this.state=state;this.currentTime=10;this.destination={};}
  async resume(){this.state='running';}
  createOscillator(){const tone={frequency:{},connect(){},disconnect(){},start:time=>tone.startAt=time,stop:time=>tone.stopAt=time};tones.push(tone);return tone;}
  createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 const source=ts.transpileModule(fs.readFileSync('app/mail-sound.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','AudioContext',source)(()=>({}),exports,AudioContext);
 return {...exports,tones};
}
test('no sound plays before audio is unlocked by a gesture',()=>{const s=sound();expect(s.playMailSound()).toBe(false);expect(s.tones).toHaveLength(0);});
test('new mail produces a short bell and coalesces a burst',()=>{const s=sound();s.prepareMailSound();expect(s.playMailSound()).toBe(true);expect(s.tones).toHaveLength(2);expect(s.tones[0].stopAt-s.tones[0].startAt).toBeCloseTo(0.6);s.playMailSound();expect(s.tones).toHaveLength(2);});
test('gesture resumes a suspended audio context',async()=>{const s=sound('suspended');s.prepareMailSound();expect(s.playMailSound()).toBe(true);});
