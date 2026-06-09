'use strict';
/* designer.js - Template Designer Editor (TDE) */
const TDE={
  selId:null, dragFieldId:null, filterGroup:'all', filterQ:'', zoom:1,

  init(){
    document.getElementById('tfc-bg').src=TPL.bgSrc;
    this.renderFieldList();
    this.renderHandles();
    this.selId=null;
    document.getElementById('tpp-none').style.display='';
    document.getElementById('tpp-form').style.display='none';
    const bg = document.getElementById('tfc-bg');
    bg.onload = () => { this.autoFitZoom(); this.renderHandles(); };
    bg.src=TPL.bgSrc;
    if(bg.complete) { this.autoFitZoom(); }
  },
  autoFitZoom(){
    const tfc = document.querySelector('.tfc');
    const wrap = document.getElementById('tfc-wrap');
    if(!tfc || !wrap) return;
    const padding = 32; // 16px padding on both sides
    const availableW = tfc.clientWidth - padding;
    const imgW = 794; // Always use base A4 width for zoom calculation
    let z = availableW / imgW;
    if(z > 1) z = 1; // Don't scale up past 100% by default
    z = Math.max(0.3, parseFloat(z.toFixed(2)));
    this.applyZoom(z);
  },
  applyZoom(z){
    this.zoom=z;
    const wrap=document.getElementById('tfc-wrap');
    if(wrap){wrap.style.transform='scale('+z+')';wrap.style.transformOrigin='top left';}
    const inp=document.getElementById('zoom-val');if(inp)inp.textContent=Math.round(z*100)+'%';
  },
  zoomIn(){this.applyZoom(Math.min(2,parseFloat(((this.zoom||1)+0.1).toFixed(1))));},
  zoomOut(){this.applyZoom(Math.max(0.3,parseFloat(((this.zoom||1)-0.1).toFixed(1))));},
  zoomReset(){this.applyZoom(1);},

  /* ── FIELD LIST ── */
  renderFieldList(){
    const q=this.filterQ.toLowerCase();
    const g=this.filterGroup;
    const list=document.getElementById('tfl-list');
    const groups={header:'\u0e2a\u0e48\u0e27\u0e19\u0e2b\u0e31\u0e27\u0e40\u0e23\u0e37\u0e48\u0e2d\u0e07',check:'Checkmarks',equip:'\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e17\u0e35\u0e48\u0e2a\u0e48\u0e07\u0e21\u0e2d\u0e1a',miss:'\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e02\u0e32\u0e14',sig:'\u0e25\u0e32\u0e22\u0e40\u0e0b\u0e47\u0e19'};
    const tagCls={header:'tag-header',check:'tag-check',equip:'tag-equip',miss:'tag-miss',sig:'tag-sig'};
    let html='';
    let curGroup='';
    ALL_FIELDS.forEach(fd=>{
      if(g!=='all'&&fd.group!==g)return;
      if(q&&!fd.label.toLowerCase().includes(q)&&!fd.id.toLowerCase().includes(q))return;
      if(fd.group!==curGroup){
        curGroup=fd.group;
        if(g==='all')html+=`<div class="tfl-group">${groups[fd.group]||fd.group}</div>`;
      }
      const placed=TPL.isPlaced(fd.id);
      html+=`<div class="tfl-item ${placed?'placed':''}" id="tfl-${fd.id}"
        draggable="true"
        ondragstart="TDE.onDragStart(event,'${fd.id}')"
        onclick="TDE.clickFromList('${fd.id}')">
        <div class="tfl-dot"></div>
        <span>${fd.label}</span>
        ${placed?`<span class="tfl-del-btn" onclick="event.stopPropagation();TDE.selId='${fd.id}';TDE.removeField()" title="ลบออกจากฟอร์ม">\u2715 ลบ</span>`:`<span style="font-size:9px;color:var(--ink3);margin-left:auto">+</span>`}
      </div>`;
    });
    if(!html)html='<div style="padding:12px;font-size:11px;color:var(--ink3)">\u0e44\u0e21\u0e48\u0e1e\u0e1a field</div>';
    list.innerHTML=html;
  },

  filterFields(){
    this.filterQ=document.getElementById('tfl-q').value;
    this.renderFieldList();
  },

  tabGroup(g,btn){
    this.filterGroup=g;
    document.querySelectorAll('.tfl-tab').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    this.renderFieldList();
  },

  /* ── DRAG FROM LIST ── */
  onDragStart(ev,fieldId){
    this.dragFieldId=fieldId;
    ev.dataTransfer.setData('text/plain',fieldId);
    ev.dataTransfer.effectAllowed='copy';
    const el=document.getElementById('tfl-'+fieldId);
    if(el)el.classList.add('dragging-src');
  },

  onDragOver(ev){ev.preventDefault();ev.dataTransfer.dropEffect='copy';},

  onDrop(ev){
    ev.preventDefault();
    const fieldId=ev.dataTransfer.getData('text/plain')||this.dragFieldId;
    if(!fieldId)return;
    const fd=ALL_FIELDS.find(f=>f.id===fieldId);
    if(!fd)return;
    // calc drop position as %
    const wrap=document.getElementById('tfc-wrap');
    const img=document.getElementById('tfc-bg');
    const rect=wrap.getBoundingClientRect();
    const iw=img.offsetWidth||794,ih=img.offsetHeight||(iw*3300/2550);
    const x=((ev.clientX-rect.left)/iw*100);
    const y=((ev.clientY-rect.top)/ih*100);
    if(!TPL.isPlaced(fd.id)) TPL.addField(fd, parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)));
    else { const f=TPL.getField(fd.id); f.x=parseFloat(x.toFixed(2)); f.y=parseFloat(y.toFixed(2)); }
    this.renderHandles();
    this.renderFieldList();
    this.selF(fieldId);
    const el=document.getElementById('tfl-'+fieldId);if(el)el.classList.remove('dragging-src');
    this.dragFieldId=null;
  },

  clickFromList(fieldId){
    const fd=ALL_FIELDS.find(f=>f.id===fieldId);
    if(!fd)return;
    if(!TPL.isPlaced(fd.id)){
      // Place at default or center
      TPL.addField(fd);
      this.renderHandles();
      this.renderFieldList();
    }
    this.selF(fieldId);
    // scroll canvas to handle
    const h=document.getElementById('fh-'+fieldId);
    if(h)h.scrollIntoView({block:'nearest',behavior:'smooth'});
  },

  /* ── HANDLES ── */
  renderHandles(){
    const wrap=document.getElementById('tfc-wrap');
    wrap.querySelectorAll('.fh').forEach(h=>h.remove());
    TPL.fields.forEach(f=>this.makeHandle(f));
    this.drawWires();
  },

  makeHandle(f){
    const wrap=document.getElementById('tfc-wrap');
    const old=document.getElementById('fh-'+f.id);if(old)old.remove();
    const img=document.getElementById('tfc-bg');
    const iw=img.offsetWidth||794,ih=img.offsetHeight||(iw*3300/2550);

    const h=document.createElement('div');
    h.className='fh'+(f.v===0?' fh-hidden':'');
    h.id='fh-'+f.id;h.dataset.id=f.id;
    h.textContent=f.label;
    h.style.left=(f.x/100*iw)+'px';
    h.style.top=(f.y/100*ih)+'px';
    h.style.fontSize=Math.round(f.fs*(iw/794))+'px';
    if(f.v===0)h.style.opacity='0.35';
    if(this.selId===f.id)h.classList.add('hi');

    h.addEventListener('mousedown',ev=>{
      ev.preventDefault();ev.stopPropagation();
      this.selF(f.id);
      h.classList.add('drag');
      const zoom=TDE.zoom||1;
      const ox=h.offsetLeft,oy=h.offsetTop,sx=ev.clientX,sy=ev.clientY;
      const onMove=e=>{
        const dx=(e.clientX-sx)/zoom,dy=(e.clientY-sy)/zoom;
        const nx=Math.max(0,Math.min(iw-2,ox+dx));
        const ny=Math.max(0,Math.min(ih-2,oy+dy));
        h.style.left=nx+'px';h.style.top=ny+'px';
        f.x=parseFloat((nx/iw*100).toFixed(3));
        f.y=parseFloat((ny/ih*100).toFixed(3));
        if(this.selId===f.id)this.updatePP(f);
        this.drawWires();
      };
      const onUp=()=>{
        h.classList.remove('drag');
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
      };
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    h.addEventListener('touchstart',ev=>{
      ev.preventDefault();ev.stopPropagation();
      this.selF(f.id);
      h.classList.add('drag');
      const zoom=TDE.zoom||1;
      const t0=ev.touches[0],ox=h.offsetLeft,oy=h.offsetTop,sx=t0.clientX,sy=t0.clientY;
      const onMove=e=>{
        e.preventDefault();
        const t=e.touches[0],dx=(t.clientX-sx)/zoom,dy=(t.clientY-sy)/zoom;
        const nx=Math.max(0,Math.min(iw-2,ox+dx));
        const ny=Math.max(0,Math.min(ih-2,oy+dy));
        h.style.left=nx+'px';h.style.top=ny+'px';
        f.x=parseFloat((nx/iw*100).toFixed(3));
        f.y=parseFloat((ny/ih*100).toFixed(3));
        if(this.selId===f.id)this.updatePP(f);
        this.drawWires();
      };
      const onUp=()=>{
        h.classList.remove('drag');
        document.removeEventListener('touchmove',onMove);
        document.removeEventListener('touchend',onUp);
      };
      document.addEventListener('touchmove',onMove,{passive:false});
      document.addEventListener('touchend',onUp);
    },{passive:false});

    // ── Delete Button ──
    const delBtn = document.createElement('div');
    delBtn.className = 'fh-del';
    delBtn.innerHTML = '&#10005;';
    delBtn.title = 'ลบ Field';
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      this.selF(f.id);
      this.removeField();
    };
    h.appendChild(delBtn);

    // ── Resize Handle ──
    const resHandle = document.createElement('div');
    resHandle.className = 'fh-res';
    resHandle.title = 'ลากเพื่อปรับขนาด';
    
    // Resize Mouse
    resHandle.addEventListener('mousedown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      this.selF(f.id);
      h.classList.add('drag');
      const zoom = TDE.zoom || 1;
      const sy = ev.clientY;
      const startFs = f.fs;
      
      const onResMove = e => {
        const dy = (e.clientY - sy) / zoom;
        let newFs = Math.max(6, Math.round(startFs + dy)); // minimum font size 6
        f.fs = newFs;
        if(f.path.startsWith('sig:')){
          // Also proportionally adjust max width for images if needed, or just let mw be handled by user
          // For images, fs acts as height. Let's make mw follow a ratio roughly.
          f.mw = Math.min(100, Math.max(2, parseFloat((newFs / ih * 100 * 2).toFixed(1)))); // rough scaling
        }
        h.style.fontSize = Math.round(f.fs*(iw/794))+'px';
        if(this.selId===f.id) this.updatePP(f);
      };
      const onResUp = () => {
        h.classList.remove('drag');
        document.removeEventListener('mousemove', onResMove);
        document.removeEventListener('mouseup', onResUp);
        this.drawWires();
      };
      document.addEventListener('mousemove', onResMove);
      document.addEventListener('mouseup', onResUp);
    });
    
    // Resize Touch
    resHandle.addEventListener('touchstart', ev => {
      ev.preventDefault(); ev.stopPropagation();
      this.selF(f.id);
      h.classList.add('drag');
      const zoom = TDE.zoom || 1;
      const sy = ev.touches[0].clientY;
      const startFs = f.fs;
      
      const onResMove = e => {
        e.preventDefault();
        const dy = (e.touches[0].clientY - sy) / zoom;
        let newFs = Math.max(6, Math.round(startFs + dy));
        f.fs = newFs;
        if(f.path.startsWith('sig:')){
          f.mw = Math.min(100, Math.max(2, parseFloat((newFs / ih * 100 * 2).toFixed(1))));
        }
        h.style.fontSize = Math.round(f.fs*(iw/794))+'px';
        if(this.selId===f.id) this.updatePP(f);
      };
      const onResUp = () => {
        h.classList.remove('drag');
        document.removeEventListener('touchmove', onResMove);
        document.removeEventListener('touchend', onResUp);
        this.drawWires();
      };
      document.addEventListener('touchmove', onResMove, {passive:false});
      document.addEventListener('touchend', onResUp);
    }, {passive:false});
    
    h.appendChild(resHandle);

    wrap.appendChild(h);
  },

  /* ── WIRES ── */
  drawWires(){
    const svg=document.getElementById('wire-svg');
    if(!svg)return;
    svg.innerHTML='';
    const wrap=document.getElementById('tfc-wrap');
    const img=document.getElementById('tfc-bg');
    const iw=img.offsetWidth||794,ih=img.offsetHeight||(iw*3300/2550);
    svg.setAttribute('width',iw);svg.setAttribute('height',ih);

    // Draw a subtle wire from list-side marker to handle (only for selected field)
    if(this.selId){
      const f=TPL.fields.find(x=>x.id===this.selId);
      if(!f)return;
      const h=document.getElementById('fh-'+f.id);
      if(!h)return;
      const hx=h.offsetLeft+h.offsetWidth/2;
      const hy=h.offsetTop+h.offsetHeight/2;
      // draw a small circle + cross at position
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',hx);circle.setAttribute('cy',hy);
      circle.setAttribute('r',6);circle.setAttribute('fill','none');
      circle.setAttribute('stroke','#e74c3c');circle.setAttribute('stroke-width',2);
      svg.appendChild(circle);
      // draw corner indicator lines
      [[hx-3,hy],[hx+3,hy],[hx,hy-3],[hx,hy+3]].forEach(([x2,y2])=>{
        const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
        ln.setAttribute('x1',hx);ln.setAttribute('y1',hy);ln.setAttribute('x2',x2);ln.setAttribute('y2',y2);
        ln.setAttribute('stroke','#e74c3c');ln.setAttribute('stroke-width',1.5);
        svg.appendChild(ln);
      });
    }
  },

  /* ── SELECT ── */
  selF(id){
    this.selId=id;
    document.querySelectorAll('.fh').forEach(h=>h.classList.remove('hi'));
    const h=document.getElementById('fh-'+id);if(h)h.classList.add('hi');
    // sidebar highlight
    document.querySelectorAll('.tfl-item').forEach(b=>b.style.background='');
    const sb=document.getElementById('tfl-'+id);
    if(sb){sb.style.background='var(--prim)';sb.scrollIntoView({block:'nearest',behavior:'smooth'});}
    const f=TPL.getField(id);if(!f)return;
    this.updatePP(f);
    document.getElementById('tpp-none').style.display='none';
    document.getElementById('tpp-form').style.display='';
    this.drawWires();
  },

  updatePP(f){
    document.getElementById('tpp-label').textContent=f.label;
    document.getElementById('tpp-path').textContent=f.path;
    document.getElementById('pp-x').value=f.x.toFixed(2);
    document.getElementById('pp-y').value=f.y.toFixed(2);
    document.getElementById('pp-fs').value=f.fs;
    document.getElementById('pp-mw').value=f.mw;
    document.getElementById('pp-vis').checked=f.v!==0;
    // populate rebind dropdown
    const sel=document.getElementById('tpp-bind');
    sel.innerHTML=ALL_FIELDS.map(fd=>`<option value="${fd.path}" ${fd.path===f.path?'selected':''}>${fd.label} (${fd.path})</option>`).join('');
  },

  ppUpd(){
    if(!this.selId)return;
    const f=TPL.getField(this.selId);if(!f)return;
    f.x=parseFloat(document.getElementById('pp-x').value)||f.x;
    f.y=parseFloat(document.getElementById('pp-y').value)||f.y;
    f.fs=parseInt(document.getElementById('pp-fs').value)||f.fs;
    f.mw=parseFloat(document.getElementById('pp-mw').value)||f.mw;
    f.v=document.getElementById('pp-vis').checked?1:0;
    const img=document.getElementById('tfc-bg');
    const iw=img.offsetWidth||794,ih=img.offsetHeight||(iw*3300/2550);
    const h=document.getElementById('fh-'+this.selId);
    if(h){
      h.style.left=(f.x/100*iw)+'px';h.style.top=(f.y/100*ih)+'px';
      h.style.fontSize=Math.round(f.fs*(iw/794))+'px';
      h.style.opacity=f.v===0?'0.35':'1';
    }
    this.updatePP(f);this.drawWires();
  },

  rebind(){
    if(!this.selId)return;
    const f=TPL.getField(this.selId);if(!f)return;
    const newPath=document.getElementById('tpp-bind').value;
    const newFd=ALL_FIELDS.find(x=>x.path===newPath);
    f.path=newPath;
    if(newFd)f.label=newFd.label;
    const h=document.getElementById('fh-'+this.selId);
    if(h)h.textContent=f.label;
    this.updatePP(f);
    this.renderFieldList();
  },

  removeField(){
    if(!this.selId)return;
    TPL.removeField(this.selId);
    const h=document.getElementById('fh-'+this.selId);if(h)h.remove();
    this.selId=null;
    document.getElementById('tpp-none').style.display='';
    document.getElementById('tpp-form').style.display='none';
    this.renderFieldList();
    this.drawWires();
  },

  /* ── BACKGROUND ── */
  changeBg(ev){
    const file=ev.target.files[0];if(!file)return;
    if(file.size>5*1024*1024){A.toast('\u0e23\u0e39\u0e1b\u0e43\u0e2b\u0e0d\u0e48\u0e40\u0e01\u0e34\u0e19 5MB','err');return;}
    const fr=new FileReader();
    fr.onload=e=>{
      TPL.bgSrc=e.target.result;
      document.getElementById('tfc-bg').src=TPL.bgSrc;
      // re-render handles after image loads
      document.getElementById('tfc-bg').onload=()=>{ this.autoFitZoom(); this.renderHandles(); };
      A.toast('\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e23\u0e39\u0e1b\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e1b\u0e23\u0e31\u0e1a\u0e15\u0e33\u0e41\u0e2b\u0e19\u0e48\u0e07 field \u0e43\u0e2b\u0e49\u0e15\u0e23\u0e07\u0e41\u0e25\u0e49\u0e27 Save','info');
    };
    fr.readAsDataURL(file);
    ev.target.value='';
  },

  resetBg(){
    TPL.bgSrc=DEFAULT_IMG;
    document.getElementById('tfc-bg').src=TPL.bgSrc;
    document.getElementById('tfc-bg').onload=()=>{ this.autoFitZoom(); this.renderHandles(); };
    A.toast('\u0e01\u0e25\u0e31\u0e1a\u0e23\u0e39\u0e1b\u0e40\u0e14\u0e34\u0e21\u0e41\u0e25\u0e49\u0e27','ok');
  },

  /* ── SAVE / RESET / PREVIEW ── */
  async save(){
    A.load('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 template...');
    try{
      await GAS.saveTemplate(TPL.toJSON());
      A.unload();A.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 template \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');
    }catch(ex){A.unload();A.toast(ex.message,'err');}
  },

  reset(){
    if(!confirm('\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15 template \u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14? \u0e23\u0e39\u0e1b\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e41\u0e25\u0e30 field \u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e08\u0e30\u0e16\u0e39\u0e01 reset'))return;
    TPL.reset();
    this.init();
    A.toast('Reset \u0e41\u0e25\u0e49\u0e27 \u2013 \u0e01\u0e14 Save \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01','info');
  },

  previewPDF(){
    const dummy={id:'IT-HO-2024-0001',docDate:'2024-01-15',docType:'deliver',name:'\u0e2a\u0e21\u0e0a\u0e32\u0e22 \u0e43\u0e08\u0e14\u0e35',hospital:'BCH',dept:'\u0e2d\u0e32\u0e22\u0e38\u0e23\u0e01\u0e23\u0e23\u0e21',deptCode:'MED01',phone:'081-234-5678',purpose:'\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e41\u0e1c\u0e19\u0e01',hodName:'\u0e27\u0e34\u0e17\u0e22\u0e32 \u0e21\u0e31\u0e48\u0e19\u0e04\u0e07',hodEmpId:'EMP001',isComplete:false,equipment:[{name:'Notebook',brand:'Dell',model:'Latitude 5420',serial:'SN001',qty:'1',remark:''},{name:'Mouse',brand:'Logitech',model:'M185',serial:'',qty:'1',remark:''}],missingItems:[{name:'Charger',qty:'1',remark:'\u0e2b\u0e32\u0e22'}],sigs:{itOfficer:null,itManager:null,recipient:null},returnInfo:null};
    const html=buildPrintHTML(dummy,TPL);
    const w=window.open('','_blank');
    if(!w){A.toast('\u0e42\u0e1b\u0e23\u0e14\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15 Pop-up','err');return;}
    w.document.write(html);w.document.close();
  }
};

/* ── PDF BUILDER ── shared between Designer preview and Print ── */
function buildPrintHTML(doc, tpl){
  const fields=tpl.fields||[];
  const bgSrc=tpl.bgSrc||DEFAULT_IMG;
  let spans='';
  fields.forEach(f=>{
    if(!f.v)return; // hidden
    const val=resolvePath(doc,f.path);
    if(f.path.startsWith('sig_name:')){
      // sig name as text
      if(!val)return;
      spans+=`<span style="position:absolute;left:${f.x.toFixed(3)}%;top:${f.y.toFixed(3)}%;font-size:${f.fs}px;font-family:Sarabun,sans-serif;color:#111;white-space:nowrap;overflow:hidden;max-width:${f.mw.toFixed(1)}%;line-height:1.2">${val}</span>`;
    } else if(f.path.startsWith('sig:')){
      // signature image only
      const sObj=val;
      if(!sObj||!sObj.sig)return;
      spans+=`<div style="position:absolute;left:${f.x.toFixed(3)}%;top:${f.y.toFixed(3)}%;max-width:${f.mw.toFixed(1)}%;height:${f.fs}px;display:flex;align-items:center;justify-content:center"><img src="${sObj.sig}" style="max-width:100%;max-height:100%;object-fit:contain"></div>`;
    } else {
      if(val===''||val===null||val===undefined)return;
      spans+=`<span style="position:absolute;left:${f.x.toFixed(3)}%;top:${f.y.toFixed(3)}%;font-size:${f.fs}px;font-family:Sarabun,sans-serif;color:#111;white-space:nowrap;overflow:hidden;max-width:${f.mw.toFixed(1)}%;line-height:1.2">${val}</span>`;
    }
  });
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${doc.id}</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff;font-family:Sarabun,sans-serif}.w{position:relative;width:794px;height:1123px;margin:0 auto;overflow:hidden}.w img.bg{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill}@media print{body{margin:0}@page{size:A4;margin:0}.w{page-break-inside:avoid}}</style></head><body><div class="w"><img class="bg" src="${bgSrc}" draggable="false">${spans}</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),900))<\/script></body></html>`;
}

/* ── MAIN APP ── */