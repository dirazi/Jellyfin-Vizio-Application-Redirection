const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../vizio-remote-nav.js'), 'utf8');
function setup(pathname='/web/vizio.html', search='?vizioNav=1') {
    const all=[], events={}; let menu=null, overlayRole='menu';
    const classes=()=>{const s=new Set();return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)};};
    function el(tag,x,y,role=null,width=80,height=40) {
        const a={tagName:tag,type:'',tabIndex:0,disabled:false,hidden:false,clicks:0,classList:classes(),style:{},
            getAttribute:k=>k==='role'?role:null,
            closest:q=>q==='label'?a.label||null:q.includes('.MuiToolbar-root')?a.bar||null:null,
            matches:()=>false,
            getBoundingClientRect:()=>({left:x,top:y,width,height,bottom:y+height,right:x+width}),
            focus:()=>{document.activeElement=a; events.focusin?.({target:a});},
            scrollIntoView:()=>{a.scrolled=true;},click:()=>{a.clicks++;},contains:b=>b.bar===a};
        all.push(a);return a;
    }
    const document={activeElement:null,documentElement:{classList:classes(),appendChild(){}},createElement:()=>({}),
        addEventListener:(t,f)=>events[t]=f,
        querySelectorAll:q=>q==='video'?[]:q.startsWith('dialog')?(menu && q.includes('[role="'+overlayRole+'"]')?[menu]:[]):q.startsWith('.skinHeader')?all.filter(a=>a.isHeader):all.filter(a=>a.tagName!=='LABEL'),
        querySelector:()=>all.find(a=>a.classList.contains('vizio-remote-focused'))};
    const window={innerHeight:1080,location:{pathname,search},getComputedStyle:a=>({display:a.hidden?'none':'block',visibility:'visible',position:a.isHeader?'fixed':'static'})};
    vm.runInNewContext(source,{window,document});
    return {el,document,events,setMenu(items, role='menu'){overlayRole=role;menu=el('UL',0,0);menu.querySelectorAll=()=>items;}};
}
function key(s,key,repeat=false){const e={key,repeat,prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};s.events.keydown(e);return e;}
const ordinary=setup('/web/index.html');assert.equal(ordinary.events.keydown,undefined);
const s=setup();const dropdown=s.el('SELECT',0,0);const label=s.el('LABEL',0,100);
const checkbox=s.el('INPUT',0,100,null,1,1);checkbox.type='checkbox';checkbox.label=label;
const disabled=s.el('INPUT',0,150,null,1,1);disabled.type='checkbox';disabled.label=s.el('LABEL',0,150);disabled.disabled=true;
const next=s.el('SELECT',0,200);s.document.activeElement=dropdown;
key(s,'ArrowDown');assert.equal(s.document.activeElement,checkbox,'1px checkbox is reachable using label geometry');
assert(label.classList.contains('vizio-remote-focused'),'yellow outline is drawn on the visible label');
assert(label.scrolled,'visible label scrolls into view');
assert.equal(key(s,'Enter').prevented,false,'Jellyfin receives checkbox Enter');
key(s,'ArrowDown');assert.equal(s.document.activeElement,next,'disabled checkbox skipped');
key(s,'ArrowUp');assert.equal(s.document.activeElement,checkbox,'Up returns to checkbox');
const m=setup();const behind=m.el('BUTTON',0,10);const profile=m.el('A',0,50,'menuitem');profile.tabIndex=-1;
const settings=m.el('LI',0,100,'menuitem');settings.tabIndex=-1;m.setMenu([profile,settings]);
m.document.activeElement=behind;key(m,'ArrowDown');assert.equal(m.document.activeElement,profile,'background cannot steal menu focus');
key(m,'ArrowDown');assert.equal(m.document.activeElement,settings,'negative tabindex menu entry is reachable');
assert(key(m,'Enter').prevented);assert.equal(settings.clicks,1,'OK activates role menuitem');
key(m,'Enter',true);assert.equal(settings.clicks,1,'held OK does not repeat click');
console.log('PASS: checkbox label geometry/focus, disabled controls, menu scope, negative tabindex, Enter and opt-in URL.');
const h=setup();const bar=h.el('HEADER',0,0,null,1000,80);bar.isHeader=true;
const left=h.el('BUTTON',0,10);left.bar=bar;
const right=h.el('BUTTON',600,10);right.bar=bar;
const lower=h.el('BUTTON',100,110);
h.document.activeElement=left;key(h,'ArrowRight');
assert.equal(h.document.activeElement,right,'Right stays in toolbar despite closer lower control');
key(h,'ArrowRight');assert.equal(h.document.activeElement,right,'toolbar edge does not fall into content');
key(h,'ArrowLeft');assert.equal(h.document.activeElement,left);
key(h,'ArrowDown');assert.equal(h.document.activeElement,lower,'Down still leaves toolbar');
assert.equal(lower.style.scrollMarginTop,'96px','focused content clears 80px fixed header plus 16px');
assert.equal(lower.style.scrollMarginBottom,'16px');
console.log('PASS: toolbar row, toolbar edge, Down into content, fixed header scroll clearance.');
const d=setup();const one=d.el('LI',0,0,'option');one.tabIndex=-1;
const two=d.el('LI',0,50,'option');two.tabIndex=-1;
const three=d.el('LI',0,100,'option');three.tabIndex=-1;
d.setMenu([one,two,three], 'listbox');d.document.activeElement=one;
key(d,'ArrowDown');assert.equal(d.document.activeElement,two,'Down reaches negative-tabindex dropdown option');
key(d,'ArrowDown');assert.equal(d.document.activeElement,three);
key(d,'ArrowUp');assert.equal(d.document.activeElement,two);
assert(key(d,'Enter').prevented);assert.equal(two.clicks,1,'OK activates selected dropdown option');
console.log('PASS: dropdown options move both ways and OK chooses the focused entry.');
