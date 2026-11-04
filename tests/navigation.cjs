const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, '../vizio-remote-nav.js'), 'utf8');
function setup(pathname='/web/vizio.html', search='?vizioNav=1') {
    const all=[], events={}; let menu=null, overlayRole='menu';
    const classes=()=>{const s=new Set();return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)};};
    function el(tag,x,y,role=null,width=80,height=40) {
        const a={tagName:tag,type:'',tabIndex:0,disabled:false,hidden:false,clicks:0,classList:classes(),style:{},y,
            getAttribute:k=>k==='role'?role:null,
            closest:q=>q==='label'?a.label||null:q.includes('.MuiToolbar-root')?a.bar||null:
                q.includes('.alphaPicker-fixed-right')?a.rail||null:q.includes('.card[data-id]')?a.card||null:
                q.includes('.mainAnimatedPage')?a.page||null:null,
            matches:()=>false,
            getBoundingClientRect:()=>{const top=a.y-(a.scrollGroup?.offset||0);return {left:x,top,width,height,bottom:top+height,right:x+width};},
            focus:()=>{document.activeElement=a; events.focusin?.({target:a});},
            scrollIntoView:()=>{a.scrolled=true;if(a.scrollGroup){const r=a.getBoundingClientRect(), top=parseFloat(a.style.scrollMarginTop)||0;
                if(r.top<top)a.scrollGroup.offset+=r.top-top;else if(r.bottom>1064)a.scrollGroup.offset+=r.bottom-1064;}},
            click:()=>{a.clicks++;},contains:b=>b.bar===a};
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

// Cards include offscreen rows: fixed headers must not win by screen distance.
const g=setup();
const gh=g.el('HEADER',0,0,null,1600,80);gh.isHeader=true;
const top=g.el('BUTTON',0,10,null,180,40);top.bar=gh;
const page={};const grid=[],scrollGroup={offset:12*240};
for(let row=0;row<14;row++) {
    const items=[];
    for(let col=0;col<3;col++) {
        const item=g.el('A',col*300,row*240+160,null,180,200);
        item.card=item;item.page=page;item.scrollGroup=scrollGroup;items.push(item);
    }
    grid.push(items);
}
g.document.activeElement=grid[12][0];
for(let row=11;row>=0;row--) {
    key(g,'ArrowUp');
    assert.equal(g.document.activeElement,grid[row][0],`Up reaches offscreen row ${row}, not the fixed header`);
    assert(grid[row][0].scrolled,`row ${row} is revealed`);
    assert.equal(grid[row][0].getBoundingClientRect().top,96,'scroll reveals selected card below the fixed header');
}
key(g,'ArrowUp');assert.equal(g.document.activeElement,top,'only the first row exits upward');
g.document.activeElement=grid[12][0];key(g,'ArrowDown');
assert.equal(g.document.activeElement,grid[13][0],'Down reaches offscreen next row');
key(g,'ArrowDown');assert.equal(g.document.activeElement,grid[13][0],'bottom stays in cards');
g.document.activeElement=grid[12][0];key(g,'ArrowLeft');
assert.equal(g.document.activeElement,grid[12][0],'left edge cannot jump into header');
key(g,'ArrowRight');assert.equal(g.document.activeElement,grid[12][1],'Right follows same card row');
key(g,'ArrowRight');assert.equal(g.document.activeElement,grid[12][2]);
key(g,'ArrowRight');assert.equal(g.document.activeElement,grid[12][2],'right edge stays without alphabet');
// An incomplete row still precedes a more aligned row further away.
const sparse=setup();const sparsePage={};
const far=sparse.el('A',1000,0,null,100,150);far.card=far;far.page=sparsePage;
const aligned=sparse.el('A',0,-300,null,100,150);aligned.card=aligned;aligned.page=sparsePage;
const lowerCard=sparse.el('A',0,300,null,100,150);lowerCard.card=lowerCard;lowerCard.page=sparsePage;
sparse.document.activeElement=lowerCard;key(sparse,'ArrowUp');
assert.equal(sparse.document.activeElement,far,'adjacent sparse row is not skipped for a closer column');
console.log('PASS: deep-grid return through every offscreen row, scroll requests, sparse rows and card edges.');

for(const type of ['Series','Season','Episode']) {
    const rows=setup(), page={}, header=rows.el('BUTTON',0,0);header.bar={};
    const first=rows.el('A',0,-100,null,100,100);first.card=first;first.page=page;
    const current=rows.el('A',0,200,null,100,100);current.card=current;current.page=page;
    const anotherPage=rows.el('A',0,80,null,100,100);anotherPage.card=anotherPage;anotherPage.page={};
    rows.document.activeElement=current;key(rows,'ArrowUp');
    assert.equal(rows.document.activeElement,first,`${type} returns to its own preceding row, not another page or header`);
}
console.log('PASS: series, season and episode boundaries stay in the active page.');

// Series, seasons and episode list rows use the same [data-id] card boundary.
const a=setup();const ah=a.el('HEADER',0,0,null,1600,80);ah.isHeader=true;
const at=a.el('BUTTON',1400,10);at.bar=ah;
const rail={}, letters=[];
for(const [i,letter] of ['#','A','B','M','N','Z'].entries()) {
    const entry=a.el('BUTTON',1500,100+i*40,null,24,30);entry.rail=rail;entry.textContent=letter;letters.push(entry);
}
const movie=a.el('A',1300,180,null,180,200);movie.card=movie;
const upperMovie=a.el('A',1300,100,null,100,50);upperMovie.card=upperMovie;
a.document.activeElement=letters[3];key(a,'ArrowUp');assert.equal(a.document.activeElement,letters[2],'M Up stays on letters despite nearby movie');
key(a,'ArrowDown');assert.equal(a.document.activeElement,letters[3]);
key(a,'ArrowRight');assert.equal(a.document.activeElement,letters[3],'Right cannot exit alphabet');
key(a,'ArrowLeft');assert.equal(a.document.activeElement,movie,'Left returns to cards');
key(a,'ArrowRight');assert.equal(a.document.activeElement,letters[4],'Right at card edge enters nearby alphabet letter');
a.document.activeElement=letters[1];key(a,'ArrowUp');assert.equal(a.document.activeElement,at,'A Up goes to header');
a.document.activeElement=letters[0];key(a,'ArrowUp');assert.equal(a.document.activeElement,at,'# is not an upper dead end');
a.document.activeElement=letters[5];key(a,'ArrowDown');assert.equal(a.document.activeElement,letters[5],'Z Down stays in alphabet');
console.log('PASS: vertical alphabet isolation, Left to cards, A/# to header, Right and Z boundaries.');

const split=setup();const toolbar1={},toolbar2={};
const discover=split.el('BUTTON',0,10);discover.bar=toolbar1;
const sync=split.el('BUTTON',700,15);sync.bar=toolbar2;
const tempting=split.el('A',100,100);tempting.card=tempting;
const otherRow=split.el('BUTTON',100,65);otherRow.bar=toolbar2;
split.document.activeElement=discover;key(split,'ArrowRight');
assert.equal(split.document.activeElement,sync,'Discover to SyncPlay crosses sibling header groups without dropping into cards');
key(split,'ArrowRight');assert.equal(split.document.activeElement,sync,'last header control stays put');
key(split,'ArrowLeft');assert.equal(split.document.activeElement,discover);
key(split,'ArrowDown');assert.notEqual(split.document.activeElement,discover,'Down still leaves header row');
console.log('PASS: sibling header groups, header row isolation and explicit Down exit.');
