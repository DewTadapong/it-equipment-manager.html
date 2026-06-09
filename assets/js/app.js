'use strict';
/* app.js - Main Application Object (A) + Global Event Listeners */
const A={
  docs:[],users:[],
  curDoc:null,curUser:null,
  signTarget:null,sigTab:'draw',retTab:'draw',
  upSig:null,retSig:null,sigCvs:null,retCvs:null,
  rowN:0,missN:0,docType:'deliver',
  fromLink:false,hodSel:null,hodTmr:null,

  async init(){
    GAS.load();
    const h=window.location.hash.slice(1);
    if(h){
      const p=new URLSearchParams(h);
      const docId=p.get('sign'),role=p.get('role'),gas=p.get('gas');
      if(gas&&!GAS.ok())GAS.saveUrl(decodeURIComponent(gas));
      if(docId&&role&&GAS.ok()){await this.handleSignLink(docId,role);return;}
    }
    if(!GAS.ok()){this.showPg('setup');return;}
    const su=this.loadSU();
    if(su&&GAS.tok){
      // Verify session is still valid before auto-login
      try{
        await GAS.get('test'); // quick ping
        this.curUser=su;await this.afterLogin();return;
      }catch{
        // Session broken or GAS unreachable — go to login
        GAS.clrTok();
        try{localStorage.removeItem('ite_u');}catch{}
      }
    }
    this.showPg('login');
  },
  loadSU(){try{const u=localStorage.getItem('ite_u');return u?JSON.parse(u):null;}catch{return null;}},
  saveSU(u){try{localStorage.setItem('ite_u',JSON.stringify(u));}catch{}},

  async login(){
    const e=document.getElementById('l-e').value.trim();
    const p=document.getElementById('l-p').value;
    if(!e||!p){this.lerr('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a');return;}
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a...');
    const btn=document.getElementById('btn-login');
    if(btn){btn.disabled=true;btn.textContent='กำลังเข้าสู่ระบบ...';}
    try{
      const d=await GAS.login(e,p);
      GAS.setTok(d.token);this.curUser=d.user;this.saveSU(d.user);
      document.getElementById('l-err').style.display='none';
      this.unload();await this.afterLogin();
    }catch(ex){
      this.unload();
      let msg=ex.message;
      if(msg.includes('Failed to fetch')||msg.includes('NetworkError')||msg.includes('HTTP'))
        msg='เชื่อมต่อ GAS ไม่ได้ — ตรวจสอบ URL และ Deploy setting (Anyone can access)';
      this.lerr(msg);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='เข้าสู่ระบบ';}
    }
  },
  lerr(m){const e=document.getElementById('l-err');e.textContent='\u2717 '+m;e.style.display='block';},
  logout(){
    GAS.clrTok();this.curUser=null;
    try{localStorage.removeItem('ite_u');}catch{}
    document.getElementById('tb-ua').style.display='none';
    document.getElementById('udd').style.display='none';
    this.showPg('login');
  },
  toggleDD(){const d=document.getElementById('udd');d.style.display=d.style.display==='none'?'block':'none';},

  async afterLogin(){
    const u=this.curUser;
    document.getElementById('tb-ua').style.display='flex';
    document.getElementById('tb-un').textContent=u.name;
    const rb=document.getElementById('tb-rb');rb.textContent=RLBL[u.role]||u.role;rb.className='rb r-'+u.role;
    document.getElementById('dd-n').textContent=u.name+' ('+u.empId+')';
    document.getElementById('dd-r').textContent=RLBL[u.role]||u.role;
    // it_staff และ admin มีสิทธิ์เต็มเหมือนกัน
    const isSuperUser=u.role==='admin'||u.role==='it_staff';
    const canAct=isSuperUser;
    document.getElementById('sb-create').style.display=canAct?'':'none';
    if(isSuperUser){
      document.getElementById('sb-adm-sec').style.display='';
      document.getElementById('sb-users').style.display='';
      document.getElementById('sb-tpl').style.display='';
      document.getElementById('sb-dept').style.display='';
      document.getElementById('sb-inventory').style.display='';
      document.getElementById('sb-io').style.display='';
      document.getElementById('sb-settings').style.display='';
      document.getElementById('sb-audit').style.display='';
      document.getElementById('sb-sys-sec').style.display='';
      document.getElementById('sb-gas-cfg').style.display='';
      const dg=document.getElementById('dd-gas-btn');if(dg)dg.style.display='';
    }
    // load template
    A.load('\u0e42\u0e2b\u0e25\u0e14 template...');
    try{
      const saved=await GAS.getTemplate();
      if(saved)TPL.fromSaved(saved);
      else TPL.reset();
    }catch{TPL.reset();}
    finally{A.unload();}
    this.loadSettings();
    // Load depts for autocomplete (background, no await)
    GAS.getDepts().then(d=>{this.depts=d;}).catch(()=>{});
    this.showPg('app');await this.loadDocs();this.sub('dash');
  },

  async testGAS(){
    const url=document.getElementById('gas-url').value.trim();if(!url){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e27\u0e32\u0e07 URL','err');return;}
    GAS.url=url;
    const el=document.getElementById('tres');
    el.style.cssText='display:block;padding:8px 10px;border-radius:6px;font-size:11px;font-weight:600;background:var(--ambm);color:var(--ambt)';
    el.textContent='\u23f3 testing...';
    try{await GAS.test();el.style.cssText='display:block;padding:8px 10px;border-radius:6px;font-size:11px;font-weight:600;background:var(--grnm);color:var(--grnt)';el.textContent='\u2713 \u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08';}
    catch(ex){el.style.cssText='display:block;padding:8px 10px;border-radius:6px;font-size:11px;font-weight:600;background:var(--redm);color:var(--red)';el.textContent='\u2717 '+ex.message;}
  },
  saveGAS(){
    const url=document.getElementById('gas-url').value.trim();if(!url){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e27\u0e32\u0e07 URL','err');return;}
    GAS.saveUrl(url);this.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e41\u0e25\u0e49\u0e27 \u2713','ok');this.showPg('login');
  },

  showPg(p){
    document.querySelectorAll('.page').forEach(el=>el.classList.remove('on'));
    document.getElementById('pg-'+p).classList.add('on');
    document.getElementById('udd').style.display='none';
    if(p==='setup'){document.getElementById('gas-url').value=GAS.url;document.getElementById('sback').style.display=GAS.ok()?'':'none';}
    if(p==='login'&&!GAS.ok())document.getElementById('gas-warn').style.display='';
    window.scrollTo(0,0);
  },
  curPage: '',
  async sub(name){
    this.curPage = name;
    if(name === 'dash') this.startPoll(); else this.stopPoll();
    ['dash','create','detail','users','dept','io','settings','tpl','audit','inventory'].forEach(s=>{const el=document.getElementById('s-'+s);if(el)el.style.display=s===name?'':'none';});
    ['sb-dash','sb-create','sb-users','sb-dept','sb-io','sb-settings','sb-tpl','sb-audit','sb-inventory'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('on');});
    const si=document.getElementById('sb-'+name);if(si)si.classList.add('on');
    
    // Lazy load components
    if(name==='audit') {
      await this.loadComponent('s-audit', 'pages/audit.html');
      if(window.Audit) Audit.loadLogs();
    }
    else if(name==='inventory') {
      await this.loadComponent('s-inventory', 'pages/inventory.html');
      if(window.INV) INV.loadData();
    }
    else if(name==='dash'){this.renderStats();this.filter();}
    else if(name==='create')this.resetCreate();
    else if(name==='users')this.loadUsers();
    else if(name==='dept')this.loadDepts();
    else if(name==='io'){}
    else if(name==='settings')this.loadSettings();
    else if(name==='tpl'){
      setTimeout(()=>{if(window.TDE&&document.getElementById('s-tpl').style.display!=='none')TDE.init();},50);
    }
    window.scrollTo(0,0);
  },

  async loadComponent(id, url) {
    const el = document.getElementById(id);
    if(el && !el.dataset.loaded) {
      try {
        const res = await fetch(url);
        const html = await res.text();
        el.innerHTML = html;
        el.dataset.loaded = '1';
      } catch(e) { console.warn('Failed to load', url); }
    }
  },

  async loadDocs(){
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25...');
    try{this.docs=await GAS.getDocs();}
    catch(ex){this.docs=[];if(ex.message.includes('Session')||ex.message.includes('login')){this.logout();return;}this.toast('\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: '+ex.message,'err');}
    finally{this.unload();}
  },

  pollTmr: null,
  startPoll(){
    this.stopPoll();
    this.pollTmr = setInterval(() => this.silentRefresh(), 60000); // 1 minute
  },
  stopPoll(){
    if(this.pollTmr) clearInterval(this.pollTmr);
  },
  async silentRefresh(){
    if(this.curPage !== 'dash') return;
    try{
      const newDocs = await GAS.getDocs();
      this.docs = newDocs;
      this.renderStats();
      this.filter();
    }catch(e){} // silent fail
  },

  renderStats(filteredDocs){
    const d=filteredDocs||this.docs;
    const pend=d.filter(x=>['pending_it_officer','pending_it_manager','pending_recipient'].includes(x.status)).length;
    document.getElementById('stats').innerHTML=
      '<div class="st a"><div class="stn">'+d.length+'</div><div class="stl">\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</div></div>'+
      '<div class="st p"><div class="stn">'+pend+'</div><div class="stl">\u0e23\u0e2d\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23</div></div>'+
      '<div class="st d"><div class="stn">'+d.filter(x=>x.status==='completed').length+'</div><div class="stl">\u0e2a\u0e48\u0e07\u0e21\u0e2d\u0e1a</div></div>'+
      '<div class="st r"><div class="stn">'+d.filter(x=>x.status==='returned').length+'</div><div class="stl">\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19</div></div>';
  },
  filter(){
    const q=(document.getElementById('qi')?.value||'').toLowerCase();
    const s=document.getElementById('qs')?.value||'';
    let list=[...this.docs];
    if(q)list=list.filter(d=>
      (d.id||'').toLowerCase().includes(q)||
      (d.name||'').toLowerCase().includes(q)||
      (d.hodName||'').toLowerCase().includes(q)||
      (d.hodEmpId||'').toLowerCase().includes(q)||
      (d.hospital||'').toLowerCase().includes(q)||
      (d.dept||'').toLowerCase().includes(q)||
      (d.equipment||[]).some(e=>(e.serial||'').toLowerCase().includes(q)||(e.name||'').toLowerCase().includes(q))
    );
    if(s)list=list.filter(d=>d.status===s);
    const qDept=(document.getElementById('qd')?.value||'').toLowerCase();
    if(qDept)list=list.filter(d=>(d.dept||'').toLowerCase().includes(qDept)||(d.deptCode||'').toLowerCase().includes(qDept));
    list.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    // Update stats based on filtered list
    this.renderStats(list);
    const tb=document.getElementById('dtb');
    if(!list.length){tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="eic">&#128194;</div><p>\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23</p></div></td></tr>';return;}
    tb.innerHTML=list.map(d=>'<tr class="tr" onclick="A.openDet(\''+d.id+'\')">'+'<td><span style="font-family:\'IBM Plex Mono\',monospace;font-weight:700;font-size:11px">'+d.id+'</span></td>'+'<td style="font-size:11px;color:var(--ink3)">'+this.fd(d.docDate||d.createdAt)+'</td>'+'<td><strong style="font-size:12px">'+(d.name||'')+'</strong></td>'+'<td><div style="font-size:11px">'+(d.hospital||'')+'</div><div style="font-size:10px;color:var(--ink3)">'+(d.dept||'')+'</div></td>'+'<td><div style="font-size:11px">'+(d.hodName||'')+'</div><div style="font-size:10px;color:var(--ink3);font-family:monospace">'+(d.hodEmpId||'')+'</div></td>'+'<td>'+this.sbadge(d.status)+'</td>'+'<td><button class="btn bh bsm" onclick="event.stopPropagation();A.openDet(\''+d.id+'\')">ดู →</button></td>'+'</tr>').join('');
  },
  sbadge(s){
    const m={pending_it_officer:['ba','\u23f3 \u0e23\u0e2d IT Officer'],pending_it_manager:['bb','\u23f3 \u0e23\u0e2d IT Manager'],pending_recipient:['bpu','\u23f3 \u0e23\u0e2d\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a'],completed:['bgg','\u2713 \u0e2a\u0e48\u0e07\u0e21\u0e2d\u0e1a'],returned:['bgr','\u21a9 \u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19']};
    const[c,l]=m[s]||['bgr',s];return'<span class="bdg '+c+'">'+l+'</span>';
  },

  setDT(t){this.docType=t;document.getElementById('lbl-dl').style.borderColor=t==='deliver'?'var(--pri)':'var(--bd2)';document.getElementById('lbl-rc').style.borderColor=t==='receive'?'var(--pri)':'var(--bd2)';},
  resetCreate(){
    ['c-nm','c-hp','c-dp','c-dc','c-ph','c-pu','c-hq'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    document.getElementById('c-he').value='';document.getElementById('c-hn').value='';
    document.getElementById('hsel').style.display='none';this.hodSel=null;
    // Clear dept autocomplete
    const ddd=document.getElementById('dpt-dd');if(ddd)ddd.classList.remove('on');
    document.getElementById('c-dt').value=new Date().toISOString().slice(0,10);
    document.querySelectorAll('input[name="dtype"]')[0].checked=true;this.setDT('deliver');
    document.querySelectorAll('input[name="comp"]')[0].checked=true;
    document.getElementById('misssec').style.display='none';
    this.rowN=0;this.missN=0;
    document.getElementById('eqr').innerHTML='';document.getElementById('misr').innerHTML='';
    this.addRow();
  },
  addRow(){
    this.rowN++;const n=this.rowN;
    const tr=document.createElement('tr');tr.id='er-'+n;
    tr.innerHTML='<td style="text-align:center;color:var(--ink3);font-size:10px;width:20px">'+n+'</td>'+
      '<td><input placeholder="Notebook..." data-f="name" style="min-width:80px"></td>'+
      '<td><input placeholder="Brand" data-f="brand" style="min-width:55px"></td>'+
      '<td><input placeholder="\u0e23\u0e38\u0e48\u0e19" data-f="model" style="min-width:55px"></td>'+
      '<td><input placeholder="Serial No." data-f="serial" style="min-width:85px"></td>'+
      '<td><input value="1" data-f="qty" style="width:40px"></td>'+
      '<td><input placeholder="Remark" data-f="remark" style="min-width:65px"></td>'+
      '<td style="width:24px">'+(n>1?'<button class="btn bic" style="background:var(--redm);color:var(--red);border:none" onclick="document.getElementById(\'er-'+n+'\').remove()">\u2715</button>':'')+'</td>';
    document.getElementById('eqr').appendChild(tr);
  },
  addMiss(){
    this.missN++;const n=this.missN;
    const tr=document.createElement('tr');tr.id='mr-'+n;
    tr.innerHTML='<td style="text-align:center;color:var(--ink3);font-size:10px;width:20px">'+n+'</td>'+
      '<td><input placeholder="\u0e0a\u0e37\u0e48\u0e2d\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c" data-f="name" style="min-width:100px"></td>'+
      '<td><input value="1" data-f="qty" style="width:40px"></td>'+
      '<td><input placeholder="\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38" data-f="remark" style="min-width:85px"></td>'+
      '<td><button class="btn bic" style="background:var(--redm);color:var(--red);border:none" onclick="document.getElementById(\'mr-'+n+'\').remove()">\u2715</button></td>';
    document.getElementById('misr').appendChild(tr);
  },
  getEq(){
    const r=[];document.querySelectorAll('#eqr tr').forEach(tr=>{const nm=tr.querySelector('[data-f="name"]')?.value.trim();if(!nm)return;r.push({name:nm,brand:tr.querySelector('[data-f="brand"]')?.value.trim()||'',model:tr.querySelector('[data-f="model"]')?.value.trim()||'',serial:tr.querySelector('[data-f="serial"]')?.value.trim()||'',qty:tr.querySelector('[data-f="qty"]')?.value.trim()||'1',remark:tr.querySelector('[data-f="remark"]')?.value.trim()||''});});return r;
  },
  getMiss(){
    const r=[];document.querySelectorAll('#misr tr').forEach(tr=>{const nm=tr.querySelector('[data-f="name"]')?.value.trim();if(!nm)return;r.push({name:nm,qty:tr.querySelector('[data-f="qty"]')?.value.trim()||'1',remark:tr.querySelector('[data-f="remark"]')?.value.trim()||''});});return r;
  },
  genId(){const y=new Date().getFullYear();return'IT-HO-'+y+'-'+String(this.docs.length+1).padStart(4,'0');},

  sHOD(){
    clearTimeout(this.hodTmr);const q=document.getElementById('c-hq').value.trim();
    if(q.length<1){document.getElementById('hdd').classList.remove('on');return;}
    this.hodTmr=setTimeout(async()=>{
      try{
        const users=await GAS.searchUsers(q);const dd=document.getElementById('hdd');
        if(!users.length){dd.innerHTML='<div class="hi" style="color:var(--ink3)">\u0e44\u0e21\u0e48\u0e1e\u0e1a</div>';dd.classList.add('on');return;}
        dd.innerHTML=users.map(u=>'<div class="hi" onclick="A.selHOD(\''+u.empId+'\',\''+u.name.replace(/'/g,"\\'")+'\',\''+(u.dept||'')+'\')"><div class="hn">'+u.name+'</div><div class="hm">\u0e23\u0e2b\u0e31\u0e2a: '+u.empId+(u.dept?' | '+u.dept:'')+'</div></div>').join('');
        dd.classList.add('on');
      }catch{}
    },280);
  },
  selHOD(eid,name,dept){
    this.hodSel={empId:eid,name,dept};
    document.getElementById('c-he').value=eid;document.getElementById('c-hn').value=name;
    document.getElementById('c-hq').value=name+' ('+eid+')';
    document.getElementById('hdd').classList.remove('on');
    document.getElementById('hsn').textContent=name;document.getElementById('hsi').textContent='('+eid+')';
    document.getElementById('hsel').style.display='';
  },
  clrHOD(){this.hodSel=null;['c-hq','c-he','c-hn'].forEach(id=>document.getElementById(id).value='');document.getElementById('hsel').style.display='none';},

  // ── Department autocomplete ──────────────────────
  deptTmr:null,
  sDept(){
    clearTimeout(this.deptTmr);
    const q=(document.getElementById('c-dp')?.value||'').trim().toLowerCase();
    const dd=document.getElementById('dpt-dd');if(!dd)return;
    if(!q){dd.classList.remove('on');return;}
    const matches=(this.depts||[]).filter(d=>(d.name||'').toLowerCase().includes(q)||(d.code||'').toLowerCase().includes(q)).slice(0,8);
    if(!matches.length){dd.classList.remove('on');return;}
    dd.innerHTML=matches.map(d=>`<div class="hi" onclick="A.selDept('${d.name}','${d.code||''}')"><div class="hn">${d.name}</div><div class="hm">${d.code?'รหัส: '+d.code:''}</div></div>`).join('');
    dd.classList.add('on');
  },
  selDept(name,code){
    const dpEl=document.getElementById('c-dp');if(dpEl)dpEl.value=name;
    const dcEl=document.getElementById('c-dc');if(dcEl)dcEl.value=code;
    const dd=document.getElementById('dpt-dd');if(dd)dd.classList.remove('on');
  },
  sDeptCode(){
    const q=(document.getElementById('c-dc')?.value||'').trim().toLowerCase();
    const dd=document.getElementById('dpt-dd');if(!dd)return;
    if(!q){dd.classList.remove('on');return;}
    const matches=(this.depts||[]).filter(d=>(d.code||'').toLowerCase().includes(q)||(d.name||'').toLowerCase().includes(q)).slice(0,8);
    if(!matches.length){dd.classList.remove('on');return;}
    dd.innerHTML=matches.map(d=>`<div class="hi" onclick="A.selDept('${d.name}','${d.code||''}')"><div class="hn">${d.name}</div><div class="hm">${d.code?'รหัส: '+d.code:''}</div></div>`).join('');
    dd.classList.add('on');
  },

  async createDoc(){
    const name=document.getElementById('c-nm').value.trim(),hosp=document.getElementById('c-hp').value.trim(),dept=document.getElementById('c-dp').value.trim(),date=document.getElementById('c-dt').value;
    if(!name||!hosp||!dept||!date){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a','err');return;}
    if(!this.hodSel){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01 HOD','err');return;}
    const eq=this.getEq();if(!eq.length){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e19\u0e49\u0e2d\u0e22 1 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23','err');return;}
    const isComp=document.querySelector('input[name="comp"]:checked').value==='y';
    const doc={id:this.genId(),createdAt:new Date().toISOString(),docDate:date,docType:this.docType,status:'pending_it_officer',name,hospital:hosp,dept,deptCode:document.getElementById('c-dc').value.trim(),phone:document.getElementById('c-ph').value.trim(),purpose:document.getElementById('c-pu').value.trim(),hodEmpId:this.hodSel.empId,hodName:this.hodSel.name,hodDept:this.hodSel.dept||'',isComplete:isComp,equipment:eq,missingItems:isComp?[]:this.getMiss(),sigs:{itOfficer:null,itManager:null,recipient:null},returnInfo:null,createdBy:this.curUser?.empId};
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...');
    try{await GAS.saveDoc(doc);this.docs.unshift(doc);this.unload();this.toast('\u0e2a\u0e23\u0e49\u0e32\u0e07 '+doc.id+' \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');this.openDet(doc.id);}
    catch(ex){this.unload();this.toast(ex.message,'err');}
  },

  docLocal(id){return this.docs.find(d=>d.id===id);},
  openDet(id){
    this.curDoc=id;const d=this.docLocal(id);
    if(d){document.getElementById('det-bc').textContent=d.id;this.renderDet(d);this.sub('detail');}
    else{this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...');GAS.getDoc(id).then(d=>{this.unload();if(!d){this.toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23','err');return;}this.docs.push(d);document.getElementById('det-bc').textContent=d.id;this.renderDet(d);this.sub('detail');}).catch(ex=>{this.unload();this.toast(ex.message,'err');});}
  },
  renderDet(doc){
    const so={pending_it_officer:0,pending_it_manager:1,pending_recipient:2,completed:3,returned:3};
    const cur=so[doc.status]??3;const canAct=this.curUser?.role==='admin'||this.curUser?.role==='it_staff';
    const stepper='<div class="step-row">'+STEPS.map((s,i)=>'<div class="step-it '+(i<cur?'dn':i===cur&&cur<3?'cr':'')+'"><div class="sdot">'+(i<cur?'\u2713':i+1)+'</div><div class="slbl">'+s.l+'</div></div>').join('')+'</div>';
    const sigs=STEPS.map((s,i)=>{
      const sig=doc.sigs?.[s.k];const isTurn=i===cur&&cur<3;
      return'<div class="scard'+(isTurn?' cur':'')+'">'+
        '<div class="shd2"><span>'+s.l+'</span>'+(sig?'<span style="color:var(--grn);font-size:10px">\u2713</span>':isTurn?'<span style="color:var(--pri);font-size:10px">\u25cf</span>':'')+'</div>'+
        '<div class="sbdy">'+(sig?'<img src="'+sig.sig+'" style="max-height:65px;max-width:100%;object-fit:contain">':'<div class="sph">&#9997;</div>')+'</div>'+
        '<div class="sft">'+(sig?'<strong>'+sig.name+'</strong>'+this.fdt(sig.at):'<span style="color:var(--bd2)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e07\u0e19\u0e32\u0e21</span>')+'</div>'+
        (isTurn?'<div class="sact"><button class="btn bp bsm" style="width:100%" onclick="A.openSign(\''+s.k+'\',\''+s.l+'\')">&#9997; \u0e25\u0e07\u0e25\u0e32\u0e22\u0e21\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d</button><button class="btn bcpy bsm" style="width:100%" onclick="A.cpyLink(\''+doc.id+'\',\''+s.k+'\')">&#128279; Copy Link</button>'+
          '<button class="btn bh bsm" style="width:100%;margin-top:4px" onclick="A.openMailModal(\''+doc.id+'\',\''+s.k+'\')">&#9993; ส่งเมลแจ้งเซ็น</button>'+
        '</div>':'')+
      '</div>';
    }).join('');
    let retSec='';
    if(doc.status==='completed'&&canAct)retSec='<div class="rbar"><h4 style="font-size:12px;font-weight:700;margin-bottom:4px">&#8617; \u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c</h4><button class="btn bp bsm" style="margin-top:4px" onclick="A.openRet(\''+doc.id+'\')">&#8617; \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19</button></div>';
    else if(doc.status==='returned'&&doc.returnInfo){
      const ri=doc.returnInfo;
      let pht='';
      if(ri.photos && ri.photos.length) {
        pht = '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' + 
              ri.photos.map(p => '<a href="'+p+'" target="_blank"><img src="'+p+'" style="height:60px;border-radius:4px;border:1px solid var(--bd2)"></a>').join('') + 
              '</div>';
      }
      retSec='<div class="rdone"><span style="font-size:18px">&#10004;</span><div style="flex:1"><div style="font-weight:700;color:var(--grnt);font-size:12px">\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19\u0e41\u0e25\u0e49\u0e27</div><div style="font-size:11px">\u0e42\u0e14\u0e22: <strong>'+ri.itName+'</strong> | '+this.fdt(ri.at)+'</div>'+(ri.note?'<div style="font-size:11px;margin-top:4px;color:var(--ink2)"><strong>หมายเหตุ:</strong> '+ri.note+'</div>':'')+pht+'</div></div>';
    }
    document.getElementById('det-body').innerHTML=
      (doc.status==='returned'?retSec:'')+
      '<div class="card">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:9px;margin-bottom:13px">'+
        '<div><div style="font-size:17px;font-weight:700;font-family:\'IBM Plex Mono\',monospace">'+doc.id+'</div><div style="font-size:10px;color:var(--ink3);margin-top:2px">\u0e2a\u0e23\u0e49\u0e32\u0e07: '+this.fdt(doc.createdAt)+'</div></div>'+
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+this.sbadge(doc.status)+
          '<button class="btn bp bsm no-print" onclick="A.print(\''+doc.id+'\')">&#128424; PDF</button>'+
          (canAct&&doc.status!=='returned'?'<button class="btn bh bsm no-print" style="color:var(--red)" onclick="A.delDoc(\''+doc.id+'\')">&#128465; \u0e25\u0e1a</button>':'')+
        '</div></div>'+
      '<div class="sh"><span class="si">&#128100;</span>\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1c\u0e39\u0e49\u0e04\u0e23\u0e2d\u0e1a\u0e04\u0e23\u0e2d\u0e07</div>'+
      '<div class="ig">'+
        '<div class="ii"><div class="lb">\u0e0a\u0e37\u0e48\u0e2d-\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25</div><div class="vl">'+(doc.name||'')+'</div></div>'+
        '<div class="ii"><div class="lb">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48</div><div class="vl">'+this.fd(doc.docDate)+'</div></div>'+
        '<div class="ii"><div class="lb">\u0e42\u0e23\u0e07\u0e1e\u0e22\u0e32\u0e1a\u0e32\u0e25</div><div class="vl">'+(doc.hospital||'')+'</div></div>'+
        '<div class="ii"><div class="lb">\u0e41\u0e1c\u0e19\u0e01/\u0e23\u0e2b\u0e31\u0e2a</div><div class="vl">'+(doc.dept||'')+' '+(doc.deptCode?'('+doc.deptCode+')':'')+'</div></div>'+
        '<div class="ii"><div class="lb">HOD</div><div class="vl">'+(doc.hodName||'')+' <span style="font-size:10px;color:var(--ink3)">('+( doc.hodEmpId||'')+')</span></div></div>'+
        '<div class="ii"><div class="lb">\u0e40\u0e1a\u0e2d\u0e23\u0e4c</div><div class="vl">'+(doc.phone||'')+'</div></div>'+
        '<div class="ii full"><div class="lb">\u0e27\u0e31\u0e15\u0e16\u0e38\u0e1b\u0e23\u0e30\u0e2a\u0e07\u0e04\u0e4c</div><div class="vl">'+(doc.purpose||'')+'</div></div>'+
      '</div>'+
      '<hr class="dvd">'+
      '<div class="sh"><span class="si">&#128187;</span>\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c</div>'+
      '<div class="tw"><table><thead><tr><th>#</th><th>\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17</th><th>Brand</th><th>\u0e23\u0e38\u0e48\u0e19</th><th>Serial</th><th>QTY</th><th>Remark</th></tr></thead>'+
      '<tbody>'+(doc.equipment||[]).map((e,i)=>'<tr><td style="color:var(--ink3);font-size:10px">'+(i+1)+'</td><td><strong>'+e.name+'</strong></td><td>'+(e.brand||'')+'</td><td>'+(e.model||'')+'</td><td style="font-family:monospace;font-size:11px">'+(e.serial||'')+'</td><td>'+(e.qty||'1')+'</td><td style="color:var(--ink3)">'+(e.remark||'')+'</td></tr>').join('')+
      '</tbody></table></div>'+
      '<div style="margin-top:8px;font-size:11px;font-weight:600">\u0e04\u0e27\u0e32\u0e21\u0e04\u0e23\u0e1a: '+(doc.isComplete?'<span class="bdg bgg">\u2713 \u0e04\u0e23\u0e1a</span>':'<span class="bdg ba">&#9888; \u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a</span>')+'</div>'+
      (!doc.isComplete&&(doc.missingItems||[]).length?'<div style="margin-top:8px"><table><thead><tr><th>#</th><th>\u0e0a\u0e37\u0e48\u0e2d\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c</th><th>\u0e08\u0e33\u0e19\u0e27\u0e19</th><th>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38</th></tr></thead><tbody>'+(doc.missingItems||[]).map((m,i)=>'<tr><td>'+(i+1)+'</td><td>'+m.name+'</td><td>'+(m.qty||'1')+'</td><td>'+(m.remark||'')+'</td></tr>').join('')+'</tbody></table></div>':'')+
      '<hr class="dvd"><div class="sh"><span class="si">&#9997;</span>\u0e25\u0e32\u0e22\u0e21\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d</div>'+
      stepper+'<div class="sgrid">'+sigs+'</div>'+(doc.status==='completed'?retSec:'')+
      '<div class="abar no-print"><button class="btn bh" onclick="A.sub(\'dash\')">\u2190 \u0e01\u0e25\u0e31\u0e1a</button><button class="btn bp bsm" onclick="A.print(\''+doc.id+'\')">&#128424; PDF</button></div>'+
      '</div>';
  },

  async delDoc(id){if(!confirm('\u0e25\u0e1a '+id+' ?'))return;this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e25\u0e1a...');try{await GAS.delDoc(id);this.docs=this.docs.filter(d=>d.id!==id);this.unload();this.toast('\u0e25\u0e1a\u0e41\u0e25\u0e49\u0e27','ok');this.sub('dash');}catch(ex){this.unload();this.toast(ex.message,'err');}},

  makeLink(docId,role){return window.location.href.split('#')[0]+'#sign='+encodeURIComponent(docId)+'&role='+role+'&gas='+encodeURIComponent(GAS.url);},
  cpyLink(docId,role){const url=this.makeLink(docId,role);if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>this.toast('\u2713 Copy Link \u0e41\u0e25\u0e49\u0e27','ok')).catch(()=>this.fbCopy(url));else this.fbCopy(url);},
  fbCopy(url){const ta=document.createElement('textarea');ta.value=url;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');this.toast('\u2713 \u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27','ok');}catch{this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32 copy URL \u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07','err');}document.body.removeChild(ta);},

  async handleSignLink(docId,role){
    this.fromLink=true;this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23...');
    try{
      const doc=await GAS.getDoc(docId);if(!doc){this.unload();alert('\u0e44\u0e21\u0e48\u0e1e\u0e1a '+docId);return;}
      const i=this.docs.findIndex(x=>x.id===docId);if(i>=0)this.docs[i]=doc;else this.docs.push(doc);
      this.curDoc=docId;this.unload();
      this.showPg('app');
      // Hide sidebar + collapse grid to full width using CSS class
      const sidebar=document.getElementById('sidebar');
      if(sidebar){sidebar.style.display='none';}
      const aw=document.querySelector('.aw');
      if(aw){aw.classList.add('sign-mode');}
      // Hide all sub-pages except detail
      ['s-dash','s-create','s-users','s-tpl','s-dept','s-io','s-settings'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
      document.getElementById('s-detail').style.display='';
      document.getElementById('det-bc').textContent=docId;
      // load template for PDF
      try{const saved=await GAS.getTemplate();if(saved)TPL.fromSaved(saved);else TPL.reset();}catch{TPL.reset();}
      this.renderDet(doc);
      if(doc.sigs?.[role]){this.toast('\u0e25\u0e07\u0e19\u0e32\u0e21\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u2713','info');return;}
      if(doc.status!==STEP_ST[role]){this.toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e16\u0e36\u0e07\u0e25\u0e33\u0e14\u0e31\u0e1a\u0e02\u0e2d\u0e07\u0e17\u0e48\u0e32\u0e19','err');return;}
      const banner=document.createElement('div');banner.className='slb';
      banner.innerHTML='<div style="font-size:18px">&#128279;</div><div><h3>\u0e04\u0e33\u0e40\u0e0a\u0e34\u0e0d\u0e25\u0e07\u0e19\u0e32\u0e21</h3><p>\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 '+docId+'</p></div>';
      document.getElementById('det-body').prepend(banner);
      setTimeout(()=>this.openSign(role,STEPS.find(s=>s.k===role)?.l||role),400);
    }catch(ex){this.unload();this.toast(ex.message,'err');}
  },

  openSign(key,label){
    this.signTarget={key,label};this.upSig=null;
    document.getElementById('sign-ttl').textContent='\u0e25\u0e07\u0e25\u0e32\u0e22\u0e21\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d \u2014 '+label;
    document.getElementById('sign-nlbl').textContent='\u0e0a\u0e37\u0e48\u0e2d '+label+' *';
    document.getElementById('sign-n').value='';
    const sigprev=document.getElementById('sig-prev-w');if(sigprev)sigprev.style.display='none';
    const siginp=document.getElementById('sigf');if(siginp)siginp.value='';
    this.sigCvs=null;this.upSig=null;
    this.sTab('draw');
    document.getElementById('m-sign').style.display='flex';
    setTimeout(()=>this.initCvs('sig-cvs','sigCvs'),120);
  },
  cSign(){document.getElementById('m-sign').style.display='none';},
  sTab(t){
    this.sigTab=t;
    ['draw','up'].forEach(tt=>{
      document.getElementById('sp-'+tt)?.classList.toggle('on',tt===t);
      document.getElementById('stab-'+tt)?.classList.toggle('on',tt===t);
    });
    if(t==='draw'&&!this.sigCvs)setTimeout(()=>this.initCvs('sig-cvs','sigCvs'),80);
    // Sync upload label visibility
    if(t==='up'){
      const lbl=document.getElementById('sig-upload-label');
      const prv=document.getElementById('sig-prev-w');
      if(lbl)lbl.style.display=this.upSig?'none':'';
      if(prv)prv.style.display=this.upSig?'block':'none';
    }
  },
  rTab(t){
    this.retTab=t;
    ['draw','up'].forEach(tt=>{
      document.getElementById('rp-'+tt).classList.toggle('on',tt===t);
      document.getElementById('rtab-'+tt).classList.toggle('on',tt===t);
    });
    if(t==='draw'&&!this.retCvs)setTimeout(()=>this.initCvs('ret-cvs','retCvs'),80);
  },
  upImg(e,store,prevId,wrapId){
    const f=e.target.files[0];if(!f)return;
    if(f.size>3*1024*1024){this.toast('ไฟล์ใหญ่เกิน 3MB','err');e.target.value='';return;}
    const fr=new FileReader();
    fr.onload=ev=>{
      this[store]=ev.target.result;
      const prev=document.getElementById(prevId);
      if(prev)prev.src=ev.target.result;
      const wrap=document.getElementById(wrapId);
      if(wrap)wrap.style.display='block';
      // hide upload area - handle both label.uarea and div#sig-upload-label
      if(e.target.id==='sigf'){
        const ulbl=document.getElementById('sig-upload-label');
        if(ulbl)ulbl.style.display='none';
      }else{
        const lbl=document.querySelector('label[for="'+e.target.id+'"]');
        if(lbl&&lbl.classList.contains('uarea'))lbl.style.display='none';
      }
    };
    fr.onerror=()=>this.toast('อ่านไฟล์ไม่สำเร็จ','err');
    fr.readAsDataURL(f);
  },
  clrImg(store,inputId,wrapId){
    this[store]=null;
    const inp=document.getElementById(inputId);if(inp)inp.value='';
    const wrap=document.getElementById(wrapId);if(wrap)wrap.style.display='none';
    // re-show upload label
    if(inputId==='sigf'){
      const ulbl=document.getElementById('sig-upload-label');
      if(ulbl)ulbl.style.display='';
    }else{
      const lbl=document.querySelector('label[for="'+inputId+'"]');
      if(lbl&&lbl.classList.contains('uarea'))lbl.style.display='block';
    }
  },
  initCvs(id,stKey){
    const old=document.getElementById(id);if(!old)return;
    const nc=old.cloneNode(false);old.parentNode.replaceChild(nc,old);
    nc.width=nc.offsetWidth||420;nc.height=parseInt(nc.getAttribute('height'))||155;
    const ctx=nc.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,nc.width,nc.height);
    ctx.strokeStyle='#0f1117';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';
    let dwg=false;
    const pos=ev=>{const r=nc.getBoundingClientRect(),sx=nc.width/r.width,sy=nc.height/r.height,s=ev.touches?ev.touches[0]:ev;return{x:(s.clientX-r.left)*sx,y:(s.clientY-r.top)*sy};};
    nc.addEventListener('mousedown',ev=>{dwg=true;const p=pos(ev);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    nc.addEventListener('mousemove',ev=>{if(!dwg)return;const p=pos(ev);ctx.lineTo(p.x,p.y);ctx.stroke();});
    nc.addEventListener('mouseup',()=>dwg=false);nc.addEventListener('mouseleave',()=>dwg=false);
    nc.addEventListener('touchstart',ev=>{ev.preventDefault();dwg=true;const p=pos(ev);ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    nc.addEventListener('touchmove',ev=>{ev.preventDefault();if(!dwg)return;const p=pos(ev);ctx.lineTo(p.x,p.y);ctx.stroke();},{passive:false});
    nc.addEventListener('touchend',()=>dwg=false);
    this[stKey]={canvas:nc,ctx};
  },
  isBlank(c){const b=document.createElement('canvas');b.width=c.width;b.height=c.height;const x=b.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,b.width,b.height);return c.toDataURL()===b.toDataURL();},
  clrCvs(id,stKey){const s=this[stKey];if(!s)return;s.ctx.fillStyle='#fff';s.ctx.fillRect(0,0,s.canvas.width,s.canvas.height);},

  async confirmSign(){
    const nm=document.getElementById('sign-n').value.trim();if(!nm){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d','err');return;}
    let sig;
    if(this.sigTab==='draw'){const c=document.getElementById('sig-cvs');if(this.isBlank(c)){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e27\u0e32\u0e14\u0e25\u0e32\u0e22\u0e40\u0e0b\u0e47\u0e19','err');return;}sig=c.toDataURL('image/jpeg',.85);}
    else{if(!this.upSig){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b','err');return;}sig=this.upSig;}
    const{key}=this.signTarget;const doc=this.docLocal(this.curDoc)||{sigs:{}};
    const sigObj={name:nm,sig,at:new Date().toISOString()};
    const newSigs={...doc.sigs,[key]:sigObj};
    const sm={itOfficer:'pending_it_manager',itManager:'pending_recipient',recipient:'completed'};
    const newStatus=sm[key]||doc.status;
    const btn=document.getElementById('btn-csign');btn.disabled=true;btn.textContent='\u23f3...';
    try{
      if(this.fromLink){await GAS.signDoc(this.curDoc,key,sigObj);doc.sigs=newSigs;doc.status=newStatus;}
      else{doc.sigs=newSigs;doc.status=newStatus;await GAS.updateDoc(this.curDoc,{sigs:newSigs,status:newStatus});}
      this.cSign();this.renderDet(doc);this.renderStats();
      this.toast('\u0e25\u0e07\u0e19\u0e32\u0e21\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');
      if(newStatus==='completed')this.toast('\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19 \u2013 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e1e\u0e34\u0e21\u0e1e\u0e4c \u2713','info');
      this.sendSignNotification(doc, key, nm);
    }catch(ex){this.toast(ex.message,'err');}
    finally{btn.disabled=false;btn.textContent='\u2713 \u0e22\u0e37\u0e19\u0e22\u0e31\u0e19';}
  },

  openRet(id){
    const doc=this.docLocal(id);this.retSig=null;
    document.getElementById('ret-n').value='';document.getElementById('ret-note').value='';
    const retprev=document.getElementById('ret-prev-w');if(retprev)retprev.style.display='none';
    const retinp=document.getElementById('retf');if(retinp)retinp.value='';
    const retlbl=document.querySelector('label[for="retf"]');
    if(retlbl&&retlbl.classList.contains('uarea'))retlbl.style.display='block';
    this.retCvs=null;
    this.rTab('draw');
    document.getElementById('ret-eql').innerHTML='<div style="font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;margin-bottom:6px">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e17\u0e35\u0e48\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19</div>'+(doc?.equipment||[]).map(e=>'<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--bd);font-size:11px"><span style="color:var(--grn)">\u2713</span><strong>'+e.name+'</strong><span style="color:var(--ink3)">'+(e.brand||'')+' '+(e.model||'')+'</span></div>').join('');
    document.getElementById('m-ret').style.display='flex';
    setTimeout(()=>this.initCvs('ret-cvs','retCvs'),100);
  },
  cRet(){document.getElementById('m-ret').style.display='none';},
  
  retPhotos: [],
  async handleReturnPhotos(event) {
    const files = event.target.files;
    if(!files || !files.length) return;
    this.load('กำลังประมวลผลรูปภาพ...');
    try {
      for(let i=0; i<files.length; i++) {
        if(this.retPhotos.length >= 3) {
          this.toast('แนบได้สูงสุด 3 รูป','err'); break;
        }
        const file = files[i];
        if(!file.type.startsWith('image/')) continue;
        const b64 = await this.resizeImage(file, 800, 800);
        this.retPhotos.push(b64);
      }
      this.renderRetPhotos();
    } catch(e) {
      this.toast('ประมวลผลรูปภาพล้มเหลว', 'err');
    } finally {
      this.unload();
      event.target.value = '';
    }
  },
  renderRetPhotos() {
    const c = document.getElementById('ret-photos-list');
    if(!c) return;
    c.innerHTML = this.retPhotos.map((b64, i) => `
      <div style="position:relative;width:60px;height:60px;border-radius:6px;border:1px solid var(--bd2);overflow:hidden;background:#f5f5f5">
        <img src="${b64}" style="width:100%;height:100%;object-fit:cover">
        <div style="position:absolute;top:2px;right:2px;background:var(--red);color:#fff;font-size:9px;width:16px;height:16px;border-radius:50%;text-align:center;line-height:16px;cursor:pointer" onclick="A.removeRetPhoto(${i})">&#10005;</div>
      </div>
    `).join('');
  },
  removeRetPhoto(i) {
    this.retPhotos.splice(i, 1);
    this.renderRetPhotos();
  },
  resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
        if(h > maxHeight) { w = w * (maxHeight / h); h = maxHeight; }
        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cvs.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
  },

  async confirmRet(){
    const itName=document.getElementById('ret-n').value.trim();if(!itName){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d IT \u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19','err');return;}
    let sig=null;if(this.retTab==='draw'){const c=document.getElementById('ret-cvs');if(!this.isBlank(c))sig=c.toDataURL('image/jpeg',.85);}else sig=this.retSig;
    const btn=document.getElementById('btn-cret');btn.disabled=true;btn.textContent='\u23f3...';
    try{
      let photoUrls = [];
      if(this.retPhotos && this.retPhotos.length > 0) {
        this.load('กำลังอัปโหลดรูปภาพหลักฐาน...');
        for(let i=0; i<this.retPhotos.length; i++) {
           const res = await GAS.post({action:'uploadImage', b64: this.retPhotos[i]});
           if(res.url) photoUrls.push(res.url);
        }
      }
      this.load('กำลังบันทึกข้อมูล...');
      const ri={itName,sig,note:document.getElementById('ret-note').value.trim(),photos:photoUrls,at:new Date().toISOString()};
      const doc=this.docLocal(this.curDoc);
      await GAS.updateDoc(this.curDoc,{returnInfo:ri,status:'returned'});doc.returnInfo=ri;doc.status='returned';this.cRet();this.renderDet(doc);this.renderStats();this.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');this.sendSignNotification(doc,'returned',itName);
    }
    catch(ex){this.toast(ex.message,'err');}finally{btn.disabled=false;btn.textContent='\u2713 \u0e22\u0e37\u0e19\u0e22\u0e31\u0e19'; this.unload();}
  },

  async sendSignNotification(doc, sigRole, signerName){
    try{
      const cfg = this.sysCfg || {};
      const notifCfg = cfg.signNotif || {};
      if(!notifCfg.enabled) return; // silent skip if not configured

      const orgName = cfg.orgName || 'IT Department';
      const roleLabels = {itOfficer:'IT Officer',itManager:'IT Manager',recipient:'\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c',returned:'\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e04\u0e37\u0e19'};
      const roleLbl = roleLabels[sigRole] || sigRole;

      // Build recipient list from config
      const toEmails = (notifCfg.recipients || []).map(r=>r.email).filter(Boolean);
      if(!toEmails.length) return;

      const to = toEmails.join(',');
      let cc = Array.isArray(cfg.ccEmails) ? cfg.ccEmails.join(',') : (cfg.ccEmails||'');

      if(notifCfg.ccEmails) cc = (cc ? cc + ',' : '') + notifCfg.ccEmails;
      if(notifCfg.ccHOD && doc.hodEmpId) {
        let hodEmail = '';
        const cached = (this.users||[]).find(u => u.empId === doc.hodEmpId);
        if(cached) hodEmail = cached.email;
        else {
           try { const res = await GAS.searchUsers(doc.hodEmpId); if(res.length) hodEmail = res[0].email; } catch(e){}
        }
        if(!hodEmail && doc.hodEmail) hodEmail = doc.hodEmail;
        if(hodEmail) cc = (cc ? cc + ',' : '') + hodEmail;
      }

      // Template
      const tplSubj = notifCfg.subject || '[IT Equipment] \u0e25\u0e07\u0e19\u0e32\u0e21\u0e41\u0e25\u0e49\u0e27 \u2014 {doc_id} ({role})';
      const tplBody = notifCfg.body || '\u0e40\u0e23\u0e35\u0e22\u0e19 \u0e17\u0e35\u0e21 IT\n\n\u0e21\u0e35\u0e01\u0e32\u0e23\u0e25\u0e07\u0e19\u0e32\u0e21{role}\u0e43\u0e19\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 {doc_id} \u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22\u0e41\u0e25\u0e49\u0e27\n\n\u0e1c\u0e39\u0e49\u0e25\u0e07\u0e19\u0e32\u0e21: {signer_name}\n\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: {signed_at}\n\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e04\u0e23\u0e2d\u0e1a\u0e04\u0e23\u0e2d\u0e07: {owner_name}\n\u0e41\u0e1c\u0e19\u0e01: {dept}\n\u0e42\u0e23\u0e07\u0e1e\u0e22\u0e32\u0e1a\u0e32\u0e25: {hospital}\n\n\u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\n{org_name}';

      const vars = {
        '{doc_id}': doc.id || '',
        '{role}': roleLbl,
        '{signer_name}': signerName,
        '{signed_at}': new Date().toLocaleString('th-TH'),
        '{owner_name}': doc.name || '',
        '{dept}': doc.dept || '',
        '{hospital}': doc.hospital || '',
        '{org_name}': orgName
      };

      let subject = tplSubj;
      let body = tplBody;
      Object.entries(vars).forEach(([k,v])=>{subject=subject.replaceAll(k,v);body=body.replaceAll(k,v);});

      const htmlBody = body.replace(/\n/g,'<br>');
      // Fire and forget
      GAS.post({action:'sendMail',to,cc,subject,body,htmlBody}).then(()=>{
        this.toast('\u2713 \u0e2a\u0e48\u0e07\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e41\u0e25\u0e49\u0e27','ok');
      }).catch(err=>{
        console.warn('Sign notification email failed:',err.message);
      });
    }catch(e){console.warn('sendSignNotification error:',e);}
  },

  async loadUsers(){this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49...');try{this.users=await GAS.getUsers();this.renderUsers();}catch(ex){this.toast(ex.message,'err');}finally{this.unload();}},
  renderUsers(){
    const tb=document.getElementById('utb');
    if(!this.users.length){tb.innerHTML='<tr><td colspan="5"><div class="empty"><p>\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49</p></div></td></tr>';return;}
    tb.innerHTML=this.users.map(u=>'<tr><td><span style="font-family:monospace;font-weight:700;font-size:11px">'+u.empId+'</span></td><td><strong>'+u.name+'</strong></td><td style="font-size:11px">'+(u.dept||'')+'</td><td style="font-size:11px;color:var(--ink3)">'+(u.email||'')+'</td><td><span class="bdg r-'+u.role+'">'+(RLBL[u.role]||u.role)+'</span></td><td><button class="btn bh bsm" onclick="A.openUM('+JSON.stringify(u).replace(/"/g,'&quot;')+')">\u0e41\u0e01\u0e49\u0e44\u0e02</button>'+(u.empId!==this.curUser?.empId?'<button class="btn bh bsm" style="color:var(--red);margin-left:4px" onclick="A.delUser(\''+(u.id||u.empId)+'\')">\u0e25\u0e1a</button>':'')+'</td></tr>').join('');
  },
  openUM(u=null){
    document.getElementById('um-t').textContent=u?'แก้ไขผู้ใช้':'เพิ่มผู้ใช้งาน';
    document.getElementById('u-e').value=u?.empId||'';document.getElementById('u-e').disabled=!!u;
    document.getElementById('u-n').value=u?.name||'';document.getElementById('u-d').value=u?.dept||'';
    document.getElementById('u-r').value=u?.role||'viewer';document.getElementById('u-p').value='';
    document.getElementById('u-id').value=u?.id||'';
    const emailEl=document.getElementById('u-email');if(emailEl)emailEl.value=u?.email||'';
    document.getElementById('m-user').style.display='flex';
  },
  cUM(){document.getElementById('m-user').style.display='none';},

  /* ── DEPARTMENTS ── */
  depts:[],
  async loadDepts(){
    this.load('กำลังโหลดแผนก...');
    try{this.depts=await GAS.getDepts();this.renderDepts();}
    catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  renderDepts(){
    const tb=document.getElementById('dept-tb');
    if(!tb)return;
    if(!this.depts.length){tb.innerHTML='<tr><td colspan="4"><div class="empty"><p>ยังไม่มีข้อมูลแผนก</p></div></td></tr>';return;}
    tb.innerHTML=this.depts.map(d=>`<tr>
      <td><span style="font-family:monospace;font-weight:700;font-size:11px">${d.code||''}</span></td>
      <td><strong>${d.name||''}</strong></td>
      <td style="font-size:11px;color:var(--ink3)">${d.desc||''}</td>
      <td>
        <button class="btn bh bsm" onclick="A.openDeptM(${JSON.stringify(d).replace(/"/g,'&quot;')})">\u0e41\u0e01\u0e49\u0e44\u0e02</button>
        <button class="btn bh bsm" style="color:var(--red);margin-left:4px" onclick="A.delDept('${d.id}')">\u0e25\u0e1a</button>
      </td>
    </tr>`).join('');
  },
  openDeptM(d=null){
    document.getElementById('dm-t').textContent=d?'\u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e1c\u0e19\u0e01':'\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e41\u0e1c\u0e19\u0e01';
    document.getElementById('dm-code').value=d?.code||'';
    document.getElementById('dm-name').value=d?.name||'';
    document.getElementById('dm-desc').value=d?.desc||'';
    document.getElementById('dm-id').value=d?.id||'';
    document.getElementById('m-dept').style.display='flex';
  },
  cDeptM(){document.getElementById('m-dept').style.display='none';},
  async saveDept(){
    const code=document.getElementById('dm-code').value.trim();
    const name=document.getElementById('dm-name').value.trim();
    if(!code||!name){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e25\u0e30\u0e0a\u0e37\u0e48\u0e2d\u0e41\u0e1c\u0e19\u0e01','err');return;}
    const id=document.getElementById('dm-id').value||code;
    this.load('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...');
    try{
      await GAS.saveDept({id,code,name,desc:document.getElementById('dm-desc').value.trim()});
      this.cDeptM();await this.loadDepts();this.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  async delDept(id){
    if(!confirm('\u0e25\u0e1a\u0e41\u0e1c\u0e19\u0e01\u0e19\u0e35\u0e49?'))return;
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e25\u0e1a...');
    try{await GAS.delDept(id);await this.loadDepts();this.toast('\u0e25\u0e1a\u0e41\u0e25\u0e49\u0e27','ok');}
    catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },

  /* ── SETTINGS ── */
  sysCfg:{},
  ccList:[], // array of CC email strings

  async loadSettings(){
    if(!GAS.ok())return;
    // Show loading in checklists immediately
    const itmEl=document.getElementById('itm-checklist');
    const itoEl=document.getElementById('ito-checklist');
    if(itmEl)itmEl.innerHTML='<div style="color:var(--ink3);font-size:11px;padding:6px">⏳ กำลังโหลด...</div>';
    if(itoEl)itoEl.innerHTML='<div style="color:var(--ink3);font-size:11px;padding:6px">⏳ กำลังโหลด...</div>';
    try{
      // Load config + IT users in parallel (getITUsers is public, no session needed)
      const [cfg, itUsersResult] = await Promise.allSettled([
        GAS.getSysCfg(),
        GAS.get('getITUsers').then(d=>d.users||[])
      ]);
      if(cfg.status==='rejected') throw new Error('getSysCfg: '+cfg.reason?.message);
      const sysCfg = cfg.value;
      this.sysCfg = sysCfg;
      // Merge IT users into this.users list for checklist rendering
      if(itUsersResult.status==='fulfilled'){
        const itUsers=itUsersResult.value;
        itUsers.forEach(iu=>{if(!this.users.find(u=>u.empId===iu.empId))this.users.push(iu);});
        if(!this.users.length)this.users=itUsers;
      }
      // Folder
      const fidEl=document.getElementById('cfg-folder-id');
      if(fidEl)fidEl.value=sysCfg.folderId||'';
      const fcur=document.getElementById('cfg-folder-cur');
      if(fcur){
        if(sysCfg.folderId){fcur.style.display='';fcur.textContent='✓ Folder ID ปัจจุบัน: '+sysCfg.folderId.slice(0,22)+'...';}
        else{fcur.style.display='none';}
      }
      // Org name
      const orgEl=document.getElementById('cfg-org');
      if(orgEl)orgEl.value=sysCfg.orgName||'Bangkok Christian Hospital';
      // CC list
      const ccRaw=sysCfg.ccEmails||'';
      this.ccList=Array.isArray(ccRaw)?ccRaw:ccRaw.split(',').map(s=>s.trim()).filter(Boolean);
      this.renderCCTags();
      // Permissions matrix
      this.renderPermMatrix(sysCfg.permissions||{});
      // Email templates
      this.renderEmailCfg(sysCfg);
      // Checklists
      this.renderITChecklists(sysCfg);
      // Sign notification
      this.renderSignNotifConfig(sysCfg);
      // Auto Reminder
      const rmd = sysCfg.reminder || {};
      const re=document.getElementById('rmd-enabled'); if(re) re.checked=rmd.enabled||false;
      const rd=document.getElementById('rmd-days'); if(rd) rd.value=rmd.days||3;
    }catch(ex){this.toast('โหลดการตั้งค่าไม่สำเร็จ: '+ex.message,'err');}
  },

  // ── Folder ID ──────────────────────────────
  async saveFolderId(){
    let raw=(document.getElementById('cfg-folder-id')?.value||'').trim();
    if(!raw){this.toast('กรุณาใส่ Folder ID หรือ URL','err');return;}
    const m=raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(m)raw=m[1];
    const m2=raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if(m2)raw=m2[1];
    this.load('กำลังบันทึก Folder ID...');
    try{
      await GAS.saveSysCfg({folderId:raw});
      const fcur=document.getElementById('cfg-folder-cur');
      if(fcur){fcur.style.display='';fcur.textContent='\u2713 บันทึกแล้ว Folder ID: '+raw.slice(0,22)+'...';}
      document.getElementById('cfg-folder-id').value=raw;
      this.toast('บันทึก Folder ID สำเร็จ \u2713','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },

  async testFolderId(){
    let raw=(document.getElementById('cfg-folder-id')?.value||'').trim();
    if(!raw){this.toast('กรุณาใส่ Folder ID หรือ URL ก่อน','err');return;}
    // Extract ID
    const m=raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(m)raw=m[1];
    const m2=raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if(m2)raw=m2[1];
    const btn=document.getElementById('btn-test-folder');
    const res=document.getElementById('folder-test-res');
    if(btn){btn.disabled=true;btn.textContent='\u23f3 Testing...';}
    if(res)res.style.display='none';
    try{
      // Call GAS test with a custom folder param
      const d=await GAS.get('testFolder',{folderId:raw});
      if(res){
        res.style.cssText='display:block;margin-top:8px;padding:8px 11px;border-radius:6px;font-size:11px;font-weight:600;background:var(--grnm);color:var(--grnt)';
        res.textContent='\u2713 Folder ใช้งานได้: '+( d.folderName||raw);
      }
      this.toast('\u2713 Folder ใช้งานได้','ok');
    }catch(ex){
      if(res){
        res.style.cssText='display:block;margin-top:8px;padding:8px 11px;border-radius:6px;font-size:11px;font-weight:600;background:var(--redm);color:var(--red)';
        res.textContent='\u2717 '+ex.message;
      }
      this.toast('Folder ใช้งานไม่ได้: '+ex.message,'err');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='\u{1F4CB} Test Folder';}
    }
  },

  // ── Permission Matrix ───────────────────────
  _defaultPerms(){
    return{
      it_staff:  {viewDocs:true,createDoc:true,editDoc:true,deleteDoc:true,manageUsers:true,settings:true,template:true,importExport:true},
      it_manager:{viewDocs:true,createDoc:false,editDoc:false,deleteDoc:false,manageUsers:false,settings:false,template:false,importExport:false},
      viewer:    {viewDocs:true,createDoc:false,editDoc:false,deleteDoc:false,manageUsers:false,settings:false,template:false,importExport:false}
    };
  },
  renderPermMatrix(perms){
    const tbl=document.getElementById('perm-tbl');if(!tbl)return;
    const roles=['it_staff','it_manager','viewer'];
    const roleLbls={it_staff:'IT Operation & Support',it_manager:'IT Manager',viewer:'Viewer'};
    const feats=[
      {k:'viewDocs',l:'ดูเอกสาร'},{k:'createDoc',l:'สร้างเอกสาร'},{k:'editDoc',l:'แก้ไข'},
      {k:'deleteDoc',l:'ลบ'},{k:'manageUsers',l:'จัดการ User'},{k:'settings',l:'ตั้งค่า'},
      {k:'template',l:'Template'},{k:'importExport',l:'Import/Export'}
    ];
    const defP=this._defaultPerms();
    const p={};
    roles.forEach(r=>{p[r]={...defP[r],...(perms[r]||{})};});
    let h='<thead><tr><th>Role / Feature</th>';
    feats.forEach(f=>h+=`<th>${f.l}</th>`);
    h+='</tr></thead><tbody>';
    roles.forEach(r=>{
      const isItStaff=r==='it_staff';
      h+=`<tr class="${isItStaff?'role-admin':''}"><td><div class="perm-row-label"><span class="bdg r-${r}">${roleLbls[r]}</span></div></td>`;
      feats.forEach(f=>{
        const checked=p[r][f.k]===true||p[r][f.k]==='own';
        h+=`<td><input type="checkbox" id="perm-${r}-${f.k}" ${checked?'checked':''} ${isItStaff?'disabled checked':''} onchange="A.onPermChange()"></td>`;
      });
      h+='</tr>';
    });
    h+='</tbody>';
    tbl.innerHTML=h;
  },
  onPermChange(){},
  async savePermissions(){
    const roles=['it_staff','it_manager','viewer'];
    const feats=['viewDocs','createDoc','editDoc','deleteDoc','manageUsers','settings','template','importExport'];
    const permissions={};
    roles.forEach(r=>{
      permissions[r]={};
      feats.forEach(f=>{
        const el=document.getElementById(`perm-${r}-${f}`);
        permissions[r][f]=el?el.checked:false;
      });
    });
    // Admin always full
    permissions.admin={viewDocs:true,createDoc:true,editDoc:true,deleteDoc:true,manageUsers:true,settings:true,template:true,importExport:true};
    this.load('กำลังบันทึก Permissions...');
    try{
      await GAS.saveSysCfg({permissions});
      this.toast('บันทึก Permissions สำเร็จ ✓','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  async resetPermissions(){
    if(!confirm('Reset Permissions กลับค่า Default?'))return;
    this.renderPermMatrix({});
    this.toast('Reset แล้ว — กด "บันทึก Permissions" เพื่อยืนยัน','info');
  },

  // ── Email Config UI ─────────────────────────
  renderEmailCfg(cfg){
    const tpl=cfg.emailTemplates||{};
    const defTpl={
      itOfficer:{subject:'[IT Equipment] ขอลายเซ็น IT Officer — {doc_id}',body:'เรียน คุณ {recipient_name}\n\nทางฝ่าย IT ขอความร่วมมือลงนามในเอกสาร {doc_id}\n\n{sign_link}\n\nขอบคุณครับ\n{sender_name}'},
      itManager:{subject:'[IT Equipment] ขอลายเซ็น IT Manager — {doc_id}',body:'เรียน คุณ {recipient_name}\n\nทางฝ่าย IT ขอความร่วมมือลงนามอนุมัติในเอกสาร {doc_id}\n\n{sign_link}\n\nขอบคุณครับ\n{sender_name}'},
      recipient:{subject:'[IT Equipment] ขอลายเซ็นรับมอบอุปกรณ์ — {doc_id}',body:'เรียน คุณ {recipient_name}\n\nทางฝ่าย IT เตรียมอุปกรณ์เรียบร้อยแล้ว กรุณาลงนามรับ:\n\n{sign_link}\n\nขอบคุณครับ\n{sender_name}'}
    };
    ['itOfficer','itManager','recipient'].forEach(role=>{
      const t={...defTpl[role],...(tpl[role]||{})};
      const sEl=document.getElementById(`etpl-${role}-subj`);
      const bEl=document.getElementById(`etpl-${role}-body`);
      if(sEl)sEl.value=t.subject||'';
      if(bEl)bEl.value=t.body||'';
    });
  },
  renderITChecklists(cfg){
    const itms=cfg.itManagerIds||[];
    const itos=cfg.itOfficerIds||[];
    const managers=this.users.filter(u=>u.role==='it_manager'||u.role==='admin');
    const officers=this.users.filter(u=>u.role==='it_staff');
    const mkList=(users,selectedIds,elId)=>{
      const el=document.getElementById(elId);if(!el)return;
      if(!this.users.length){
        el.innerHTML='<div style="color:var(--amb);font-size:11px;padding:8px;background:var(--ambm);border-radius:6px">⚠ ไม่สามารถโหลดรายชื่อ user — กรุณา login ด้วย Admin account</div>';
        return;
      }
      if(!users.length){
        el.innerHTML='<div style="color:var(--ink3);font-size:11px;padding:6px">ยังไม่มี user ในกลุ่มนี้ — เพิ่มได้ที่เมนู "จัดการผู้ใช้"</div>';
        return;
      }
      el.innerHTML=users.map(u=>`<label class="ucl-item"><input type="checkbox" id="ucl-${elId}-${u.empId}" value="${u.empId}" ${selectedIds.includes(u.empId)?'checked':''}><span class="ui-name">${u.name}</span><span class="ui-id">${u.empId}${u.email?' · '+u.email:''}</span></label>`).join('');
    };
    mkList(managers,itms,'itm-checklist');
    mkList(officers,itos,'ito-checklist');
  },
  eTab(role){
    ['itOfficer','itManager','recipient'].forEach(r=>{
      document.getElementById('etab-'+r)?.classList.toggle('on',r===role);
      document.getElementById('epane-'+r)?.classList.toggle('on',r===role);
    });
  },
  insertVar(role,varStr){
    const ta=document.getElementById(`etpl-${role}-body`);if(!ta)return;
    const s=ta.selectionStart,e=ta.selectionEnd;
    ta.value=ta.value.slice(0,s)+varStr+ta.value.slice(e);
    ta.selectionStart=ta.selectionEnd=s+varStr.length;
    ta.focus();
  },

  // ── CC Tags ────────────────────────────────
  renderCCTags(){
    const el=document.getElementById('cc-tags');if(!el)return;
    el.innerHTML=this.ccList.map((em,i)=>`<span class="cc-tag">${em}<span class="cc-tag-x" onclick="A.removeCCTag(${i})">×</span></span>`).join('');
  },
  addCCTag(){
    const inp=document.getElementById('cfg-cc-input');if(!inp)return;
    const raw=inp.value;
    const emails=raw.split(/[,\s]+/).map(s=>s.trim()).filter(s=>s.includes('@'));
    emails.forEach(em=>{if(!this.ccList.includes(em))this.ccList.push(em);});
    inp.value='';this.renderCCTags();
  },
  removeCCTag(i){this.ccList.splice(i,1);this.renderCCTags();},
  ccKeydown(ev){if(ev.key==='Enter'||ev.key===','){ev.preventDefault();this.addCCTag();}},

  // ── Save Email Config ──────────────────────
  async saveEmailConfig(){
    const org=(document.getElementById('cfg-org')?.value||'').trim()||'Bangkok Christian Hospital';
    const ccEmails=this.ccList.join(',');
    // Collect IT Manager IDs
    const itManagerIds=[...document.querySelectorAll('#itm-checklist input[type=checkbox]:checked')].map(cb=>cb.value);
    const itOfficerIds=[...document.querySelectorAll('#ito-checklist input[type=checkbox]:checked')].map(cb=>cb.value);
    // Collect templates
    const emailTemplates={};
    ['itOfficer','itManager','recipient'].forEach(role=>{
      emailTemplates[role]={
        subject:document.getElementById(`etpl-${role}-subj`)?.value||'',
        body:document.getElementById(`etpl-${role}-body`)?.value||''
      };
    });
    this.load('กำลังบันทึก...');
    try{
      await GAS.saveSysCfg({orgName:org,ccEmails,itManagerIds,itOfficerIds,emailTemplates});
      this.sysCfg={...this.sysCfg,orgName:org,ccEmails,itManagerIds,itOfficerIds,emailTemplates};
      this.toast('บันทึกการตั้งค่าอีเมลสำเร็จ ✓','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },

  // ── Sign Notification Config ─────────────────────────────
  signNotifRecipients: [],
  signNotifSearch: '',
  snCcList: [],

  renderSnCCTags(){
    const el=document.getElementById('sn-cc-tags');if(!el)return;
    el.innerHTML=this.snCcList.map((em,i)=>`<span class="cc-tag">${em}<span class="cc-tag-x" onclick="A.removeSnCCTag(${i})">×</span></span>`).join('');
  },
  addSnCCTag(){
    const inp=document.getElementById('sn-cc-input');if(!inp)return;
    const raw=inp.value;
    const emails=raw.split(/[,\s]+/).map(s=>s.trim()).filter(s=>s.includes('@'));
    emails.forEach(em=>{if(!this.snCcList.includes(em))this.snCcList.push(em);});
    inp.value='';this.renderSnCCTags();
  },
  removeSnCCTag(i){this.snCcList.splice(i,1);this.renderSnCCTags();},
  snCcKeydown(ev){if(ev.key==='Enter'||ev.key===','){ev.preventDefault();this.addSnCCTag();}},

  async saveSignNotifConfig(){
    const cfg = {
      enabled: document.getElementById('sn-enabled')?.checked || false,
      subject: document.getElementById('sn-subj')?.value || '',
      body: document.getElementById('sn-body')?.value || '',
      recipients: this.signNotifRecipients,
      ccHOD: document.getElementById('sn-cc-hod')?.checked || false,
      ccEmails: this.snCcList.join(',')
    };
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...');
    try{
      await GAS.saveSysCfg({signNotif: cfg});
      this.sysCfg = {...this.sysCfg, signNotif: cfg};
      this.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },

  async saveReminderConfig() {
    const cfg = {
      enabled: document.getElementById('rmd-enabled')?.checked || false,
      days: document.getElementById('rmd-days')?.value || 3
    };
    this.load('กำลังบันทึก...');
    try {
      await GAS.saveSysCfg({reminder: cfg});
      this.sysCfg = {...this.sysCfg, reminder: cfg};
      this.toast('บันทึกการตั้งค่าแจ้งเตือนสำเร็จ ✓','ok');
    } catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  
  async installReminderTrigger() {
    if(!confirm('ติดตั้งระบบทำงานอัตโนมัติ?\n\n* หากยังไม่ได้อนุญาตการทำงานของ Script ระบบอาจจะแจ้ง Error ได้\n(ต้องเปิด Apps Script Editor แล้วสั่ง Run testAuth ก่อน)')) return;
    this.load('กำลังติดตั้ง Trigger...');
    try {
      await GAS.post({action:'installReminderTrigger'});
      this.toast('ติดตั้งสำเร็จ ✓','ok');
    } catch(ex) {
      alert('ติดตั้งไม่สำเร็จ: ' + ex.message);
    } finally {
      this.unload();
    }
  },

  renderSignNotifConfig(cfg){
    const sn = cfg.signNotif || {};
    const en = document.getElementById('sn-enabled');
    if(en) en.checked = sn.enabled || false;
    const subj = document.getElementById('sn-subj');
    if(subj) subj.value = sn.subject || '[IT Equipment] \u0e25\u0e07\u0e19\u0e32\u0e21\u0e41\u0e25\u0e49\u0e27 \u2014 {doc_id} ({role})';
    const body = document.getElementById('sn-body');
    if(body) body.value = sn.body || '\u0e40\u0e23\u0e35\u0e22\u0e19 \u0e17\u0e35\u0e21 IT\n\n\u0e21\u0e35\u0e01\u0e32\u0e23\u0e25\u0e07\u0e19\u0e32\u0e21{role}\u0e43\u0e19\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 {doc_id} \u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22\u0e41\u0e25\u0e49\u0e27\n\n\u0e1c\u0e39\u0e49\u0e25\u0e07\u0e19\u0e32\u0e21: {signer_name}\n\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48: {signed_at}\n\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e04\u0e23\u0e2d\u0e1a\u0e04\u0e23\u0e2d\u0e07: {owner_name}\n\u0e41\u0e1c\u0e19\u0e01: {dept}\n\u0e42\u0e23\u0e07\u0e1e\u0e22\u0e32\u0e1a\u0e32\u0e25: {hospital}\n\n\u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\n{org_name}';
    this.signNotifRecipients = Array.isArray(sn.recipients) ? [...sn.recipients] : [];
    this.renderSnRecipients();
    
    const chod=document.getElementById('sn-cc-hod');
    if(chod) chod.checked=sn.ccHOD||false;
    const ccRaw=sn.ccEmails||'';
    this.snCcList=Array.isArray(ccRaw)?ccRaw:ccRaw.split(',').map(s=>s.trim()).filter(Boolean);
    this.renderSnCCTags();
  },

  renderSnRecipients(){
    const el = document.getElementById('sn-recip-list');
    if(!el) return;
    if(!this.signNotifRecipients.length){
      el.innerHTML = '<div style="color:var(--ink3);font-size:11px;padding:8px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a \u2014 \u0e04\u0e49\u0e19\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e14\u0e49\u0e32\u0e19\u0e25\u0e48\u0e32\u0e07</div>';
      return;
    }
    el.innerHTML = this.signNotifRecipients.map((r,i)=>`
      <div class="sn-recip-tag">
        <span class="sn-rt-name">${r.name}</span>
        <span class="sn-rt-email">${r.email}</span>
        <button class="sn-rt-remove" onclick="A.removeSnRecip(${i})" title="\u0e25\u0e1a">&#10005;</button>
      </div>`).join('');
  },

  removeSnRecip(idx){
    this.signNotifRecipients.splice(idx, 1);
    this.renderSnRecipients();
  },

  snSearchTmr: null,
  searchSnUser(){
    clearTimeout(this.snSearchTmr);
    const q = (document.getElementById('sn-search')?.value || '').trim();
    const dd = document.getElementById('sn-search-dd');
    if(!dd) return;
    if(q.length < 1){ dd.classList.remove('on'); return; }
    this.snSearchTmr = setTimeout(()=>{
      const matches = (this.users || []).filter(u=>
        (u.name||'').toLowerCase().includes(q.toLowerCase()) ||
        (u.empId||'').toLowerCase().includes(q.toLowerCase()) ||
        (u.email||'').toLowerCase().includes(q.toLowerCase())
      ).slice(0,8);
      if(!matches.length){ dd.innerHTML = '<div class="hi" style="color:var(--ink3)">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49</div>'; dd.classList.add('on'); return; }
      dd.innerHTML = matches.map(u=>{
        const alreadyAdded = this.signNotifRecipients.some(r=>r.empId===u.empId);
        return `<div class="hi ${alreadyAdded?'sn-added':''}" onclick="${alreadyAdded?'':'A.addSnRecip('+JSON.stringify(u).replace(/"/g,'&quot;')+')'}">` +
          `<div class="hn">${u.name}${alreadyAdded?' <span style="color:var(--grn);font-size:10px">\u2713 \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e41\u0e25\u0e49\u0e27</span>':''}</div>` +
          `<div class="hm">${u.empId}${u.email?' | '+u.email:' | <span style="color:var(--amb)">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e35\u0e40\u0e21\u0e25</span>'}</div></div>`;
      }).join('');
      dd.classList.add('on');
    }, 250);
  },

  addSnRecip(user){
    if(!user.email){ this.toast('\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e43\u0e19\u0e23\u0e30\u0e1a\u0e1a','err'); return; }
    if(this.signNotifRecipients.some(r=>r.empId===user.empId)){
      this.toast('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27','info'); return;
    }
    this.signNotifRecipients.push({empId:user.empId, name:user.name, email:user.email});
    this.renderSnRecipients();
    document.getElementById('sn-search').value = '';
    document.getElementById('sn-search-dd').classList.remove('on');
    this.toast('\u0e40\u0e1e\u0e34\u0e48\u0e21 '+user.name+' \u0e41\u0e25\u0e49\u0e27 \u2713','ok');
  },

  /* ── MAILTO ── */
  _mailTarget:null,
  _mailSignUrl:null,

  openMailModal(docId,sigRole){
    const doc=this.docLocal(docId);if(!doc)return;
    const cfg=this.sysCfg||{};
    const tplCfg=(cfg.emailTemplates||{})[sigRole]||{};
    const orgName=cfg.orgName||'IT Department';

    const signUrl=this.makeLink(docId,sigRole);
    this._mailSignUrl=signUrl;

    // Determine recipient name and email
    let toEmail='',toName='';
    if(sigRole==='recipient'){
      toName=doc.hodName||doc.name||'';
      const hodUser=this.users.find(u=>u.empId===doc.hodEmpId);
      toEmail=hodUser?.email||doc.hodEmail||'';
    } else if(sigRole==='itManager'){
      // Use IT Manager checklist
      const ids=cfg.itManagerIds||[];
      const toUsers=this.users.filter(u=>ids.includes(u.empId));
      toEmail=toUsers.map(u=>u.email).filter(Boolean).join(', ');
      toName=toUsers.map(u=>u.name).join(', ')||'IT Manager';
    } else {
      // IT Officer
      const ids=cfg.itOfficerIds||[];
      const toUsers=this.users.filter(u=>ids.includes(u.empId));
      toEmail=toUsers.map(u=>u.email).filter(Boolean).join(', ');
      toName=toUsers.map(u=>u.name).join(', ')||'IT Officer';
    }

    const senderName=this.curUser?.name||orgName;
    const ccStr=Array.isArray(cfg.ccEmails)?cfg.ccEmails.join(', '):(cfg.ccEmails||'');

    // Apply template variables
    const vars={
      '{recipient_name}':toName,'{doc_id}':docId,'{name}':doc.name||'',
      '{dept}':doc.dept||'','{hospital}':doc.hospital||'',
      '{sender_name}':senderName+'\nฝ่าย IT | '+orgName,
      '{sign_link}':signUrl
    };
    let subj=tplCfg.subject||`[IT Equipment] ขอลายเซ็น — ${docId}`;
    let body=tplCfg.body||`เรียน คุณ ${toName}\n\n${signUrl}\n\nขอบคุณครับ\n${senderName}`;
    Object.entries(vars).forEach(([k,v])=>{subj=subj.replaceAll(k,v);body=body.replaceAll(k,v);});

    // Store for mailto
    this._mailTarget={to:toEmail,cc:ccStr,subj,body,docId,sigRole,signUrl};

    // Build preview HTML — {sign_link} already replaced with URL above, render as button
    const bodyHtml=body.split('\n').map(line=>{
      if(line===signUrl){
        return `<a href="${signUrl}" target="_blank" class="sign-link-btn" style="text-decoration:none;display:inline-flex">&#128279; เปิดลิงก์ลงนาม</a>`;
      }
      return `<span>${line}</span>`;
    }).join('<br>');

    document.getElementById('mail-to').textContent=toEmail||'(ไม่พบอีเมล — ตรวจสอบ User)';
    document.getElementById('mail-cc').textContent=ccStr||'-';
    document.getElementById('mail-subj').textContent=subj;
    document.getElementById('mail-body-prev').innerHTML=bodyHtml;
    document.getElementById('m-mail').style.display='flex';
    if(!toEmail)this.toast('คำเตือน: ไม่พบอีเมลของผู้รับ — ตรวจสอบ User','err');
  },
  cMail(){document.getElementById('m-mail').style.display='none';},

  openMailClient(){
    if(!this._mailTarget)return;
    const{to,cc,subj,body}=this._mailTarget;
    const mailto=`mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.location.href=mailto;
    this.cMail();
    this.toast('เปิด Email Client แล้ว — กด Send ในโปรแกรมอีเมลของคุณ','info');
  },

  async sendViaGAS(){
    if(!this._mailTarget)return;
    const{to,cc,subj,body,signUrl}=this._mailTarget;
    if(!to){this.toast('ไม่พบอีเมลผู้รับ — ตรวจสอบ User และ Email Config','err');return;}
    const btn=document.getElementById('btn-send-gas');
    if(btn){btn.disabled=true;btn.textContent='⏳ กำลังส่ง...';}
    try{
      // Replace plain URL in body with HTML button for email
      const htmlBody=body.replace(signUrl,`<a href="${signUrl}" style="display:inline-block;padding:10px 20px;background:#1a5276;color:#fff;border-radius:6px;text-decoration:none;font-weight:700">📝 คลิกเพื่อลงนาม</a>`).replace(/\n/g,'<br>');
      await GAS.post({action:'sendMail',to,cc,subject:subj,body,htmlBody});
      this.cMail();
      this.toast('✓ ส่งอีเมลสำเร็จ','ok');
    }catch(ex){
      this.toast('ส่งอีเมลไม่สำเร็จ: '+ex.message,'err');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='📨 ส่งอีเมลผ่าน GAS';}
    }
  },

  /* ── AFTER SIGN auto reply ── */
  mailAfterSign(docId,role){
    const doc=this.docLocal(docId)||{id:docId};
    const cfg=this.sysCfg||{};
    const orgName=cfg.orgName||'IT Department';
    const roleLabels={itOfficer:'IT Officer',itManager:'IT Manager',recipient:'ผู้รับอุปกรณ์'};
    const roleLbl=roleLabels[role]||role;
    const docLink=window.location.href.split('#')[0]+'#sign='+encodeURIComponent(docId)+'&role=view&gas='+encodeURIComponent(GAS.url);
    const itManagerIds=cfg.itManagerIds||[];
    const itMs=this.users.filter(u=>itManagerIds.includes(u.empId));
    const toEmail=itMs.map(u=>u.email).filter(Boolean).join(', ');
    const ccStr=Array.isArray(cfg.ccEmails)?cfg.ccEmails.join(', '):(cfg.ccEmails||'');
    const subj=encodeURIComponent(`Re: [IT Equipment] ขอลายเซ็น${roleLbl} — ${docId}`);
    const bodyTxt=encodeURIComponent([`เรียน ทีม IT`,``,`ได้ทำการลงนาม${roleLbl}ในเอกสาร ${docId} เรียบร้อยแล้ว`,``,`ดูเอกสารได้ที่: ${docLink}`,``,`ขอบคุณ`].join('\n'));
    const mailto=`mailto:${encodeURIComponent(toEmail)}?cc=${encodeURIComponent(ccStr)}&subject=${subj}&body=${bodyTxt}`;
    if(confirm('ต้องการส่งอีเมลแจ้งว่าลงนามแล้ว?')){window.location.href=mailto;}
  },
  async saveUser(){
    const eid=document.getElementById('u-e').value.trim(),nm=document.getElementById('u-n').value.trim();
    if(!eid||!nm){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25','err');return;}
    const pw=document.getElementById('u-p').value||null;
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...');
    const emailVal=(document.getElementById('u-email')?.value||'').trim();
    try{await GAS.saveUser({id:document.getElementById('u-id').value||eid,empId:eid,name:nm,dept:document.getElementById('u-d').value.trim(),role:document.getElementById('u-r').value,pw,email:emailVal||null});this.cUM();await this.loadUsers();this.toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');}
    catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  async delUser(id){if(!confirm('\u0e25\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49?'))return;this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e25\u0e1a...');try{await GAS.delUser(id);await this.loadUsers();this.toast('\u0e25\u0e1a\u0e41\u0e25\u0e49\u0e27','ok');}catch(ex){this.toast(ex.message,'err');}finally{this.unload();}},
  openCPW(){document.getElementById('udd').style.display='none';['cp-o','cp-n','cp-n2'].forEach(id=>document.getElementById(id).value='');document.getElementById('m-cpw').style.display='flex';},
  cCPW(){document.getElementById('m-cpw').style.display='none';},
  async chgPw(){
    const o=document.getElementById('cp-o').value,n=document.getElementById('cp-n').value,n2=document.getElementById('cp-n2').value;
    if(!o||!n){this.toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19','err');return;}
    if(n!==n2){this.toast('\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e44\u0e21\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19','err');return;}
    this.load('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19...');
    try{await GAS.changePw(o,n);this.cCPW();this.toast('\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2713','ok');}
    catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },

  async print(id){
    const doc=this.docLocal(id);if(!doc){this.toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23','err');return;}
    const html=buildPrintHTML(doc,TPL);
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);const w=window.open(url,'_blank');
    if(!w){this.toast('\u0e42\u0e1b\u0e23\u0e14\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15 Pop-up','err');return;}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    this.toast('\u0e01\u0e14 Ctrl+P \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 PDF','info');
  },

  /* ── IMPORT / EXPORT ── */
  /* ── CSV Helpers ── */
  buildCSV(headers, rows) {
    const esc = (s) => `"${(s||'').toString().replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(',')];
    rows.forEach(r => lines.push(r.map(esc).join(',')));
    return '\uFEFF' + lines.join('\n'); // Add BOM for Excel UTF-8 support
  },
  parseCSV(txt) {
    const lines = txt.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return [];
    const parseLine = (line) => {
      const result = []; let current = '', inQuotes = false;
      for(let i=0; i<line.length; i++){
        const c = line[i];
        if(c === '"' && line[i+1] === '"') { current += '"'; i++; }
        else if(c === '"') { inQuotes = !inQuotes; }
        else if(c === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += c; }
      }
      result.push(current); return result;
    };
    const headers = parseLine(lines[0]).map(h=>h.trim());
    return lines.slice(1).map(l=>{
      const row = parseLine(l);
      const obj = {};
      headers.forEach((h,i)=>obj[h] = row[i]?.trim()||'');
      return obj;
    });
  },

  /* ── EXPORT / IMPORT CSV ── */
  exportUsersCSV(){
    if(!this.users || !this.users.length){ this.toast('ไม่มีข้อมูล User','err'); return; }
    const headers = ['empId','name','dept','email','role'];
    const rows = this.users.map(u => headers.map(h => u[h]||''));
    const csv = this.buildCSV(headers, rows);
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'IT_Users_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  },
  async importUsersCSV(event){
    const file=event.target.files[0];if(!file)return;
    try{
      const text=await file.text();
      const users=this.parseCSV(text);
      if(!users.length){ this.toast('รูปแบบไฟล์ไม่ถูกต้อง หรือไม่มีข้อมูล','err'); return; }
      if(!confirm(`นำเข้าข้อมูล User ${users.length} รายการ?\n(ข้อมูลเดิมจะถูกอัปเดต ถ้าไม่มีจะถูกเพิ่มใหม่)`))return;
      this.load('กำลัง import users...');
      const result=await GAS.post({action:'importUsersCSV', users});
      this.toast(`Import สำเร็จ: เพิ่ม ${result.added||0}, อัปเดต ${result.updated||0}`,'ok');
      await this.loadUsers();
    }catch(ex){ this.toast('Import failed: '+ex.message,'err'); }
    finally{ this.unload(); event.target.value=''; }
  },

  exportDeptsCSV(){
    if(!this.depts || !this.depts.length){ this.toast('ไม่มีข้อมูล Department','err'); return; }
    const headers = ['code','name','desc'];
    const rows = this.depts.map(d => headers.map(h => d[h]||''));
    const csv = this.buildCSV(headers, rows);
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'IT_Depts_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  },
  async importDeptsCSV(event){
    const file=event.target.files[0];if(!file)return;
    try{
      const text=await file.text();
      const depts=this.parseCSV(text);
      if(!depts.length){ this.toast('รูปแบบไฟล์ไม่ถูกต้อง หรือไม่มีข้อมูล','err'); return; }
      if(!confirm(`นำเข้าข้อมูล Department ${depts.length} รายการ?\n(ข้อมูลเดิมจะถูกอัปเดต ถ้าไม่มีจะถูกเพิ่มใหม่)`))return;
      this.load('กำลัง import depts...');
      const result=await GAS.post({action:'importDeptsCSV', depts});
      this.toast(`Import สำเร็จ: เพิ่ม ${result.added||0}, อัปเดต ${result.updated||0}`,'ok');
      await this.loadDepts();
    }catch(ex){ this.toast('Import failed: '+ex.message,'err'); }
    finally{ this.unload(); event.target.value=''; }
  },

  async exportAll(){
    this.load('กำลัง export...');
    try{
      const data=await GAS.exportAll();
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;
      a.download='IT_Equipment_Backup_'+new Date().toISOString().slice(0,10)+'.json';
      a.click();URL.revokeObjectURL(url);
      this.toast('Export สำเร็จ ✓','ok');
    }catch(ex){this.toast(ex.message,'err');}finally{this.unload();}
  },
  async exportDocs(){
    const blob=new Blob([JSON.stringify({docs:this.docs,exported:new Date().toISOString()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
    a.download='IT_Docs_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
    this.toast('Export เอกสารสำเร็จ ✓','ok');
  },
  async importAll(event){
    const file=event.target.files[0];if(!file)return;
    const el=document.getElementById('import-result');
    el.style.cssText='display:block;padding:9px 11px;border-radius:6px;font-size:12px;font-weight:600;background:var(--ambm);color:var(--ambt)';
    el.textContent='⏳ กำลังอ่านไฟล์...';
    try{
      const text=await file.text();const data=JSON.parse(text);
      if(!confirm('นำเข้าข้อมูล?ข้อมูลเดิมจะถูกแทนที่'))return;
      this.load('กำลัง import...');
      const result=await GAS.importAll(data);
      el.style.cssText='display:block;padding:9px 11px;border-radius:6px;font-size:12px;font-weight:600;background:var(--grnm);color:var(--grnt)';
      el.textContent='✓ Import สำเร็จ — '+JSON.stringify(result);
      await this.loadDocs();
    }catch(ex){
      el.style.cssText='display:block;padding:9px 11px;border-radius:6px;font-size:12px;font-weight:600;background:var(--redm);color:var(--red)';
      el.textContent='✗ '+ex.message;
    }finally{this.unload();event.target.value='';}
  },


  clearAll(){
    if(!confirm('ล้างค่าทั้งหมด (GAS URL, session, cache)?\nต้องตั้งค่าใหม่หลังจากนี้'))return;
    try{localStorage.clear();}catch{}
    GAS.url='';GAS.tok='';
    document.getElementById('gas-warn').style.display='';
    document.getElementById('l-e').value='';
    document.getElementById('l-p').value='';
    document.getElementById('l-err').style.display='none';
    this.toast('ล้างค่าแล้ว — กรุณาตั้งค่า GAS URL ใหม่','info');
    this.showPg('setup');
  },
    load(t){document.getElementById('ld-t').textContent=t||'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...';document.getElementById('ld').classList.add('on');},
  unload(){document.getElementById('ld').classList.remove('on');},
  toast(msg,t){
    const c=document.getElementById('toasts');const el=document.createElement('div');el.className='toast t'+(t||'ok');el.textContent=msg;c.appendChild(el);
    setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);},4500);
  },
  fd(iso){if(!iso)return'-';try{return new Date(iso).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'});}catch{return iso;}},
  fdt(iso){if(!iso)return'-';try{return new Date(iso).toLocaleString('th-TH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return iso;}}
};

document.addEventListener('click',e=>{
  if(!e.target.closest('#tb-ubtn')&&!e.target.closest('#udd'))document.getElementById('udd').style.display='none';
  if(!e.target.closest('.hw'))document.getElementById('hdd')?.classList.remove('on');
});
document.querySelectorAll('input[name="comp"]').forEach(r=>{
  r.addEventListener('change',()=>document.getElementById('misssec').style.display=r.value==='n'?'':'none');
});
// Mobile: tap overlay backdrop to close modal
document.addEventListener('click', function(mev) {
  if (mev.target.classList.contains('ov')) mev.target.style.display = 'none';
  if (!mev.target.closest('.hw')) document.querySelectorAll('.hdd.on').forEach(function(d) { d.classList.remove('on'); });
});
