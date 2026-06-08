/**
 * IT Equipment Manager — Google Apps Script v10
 * Features:
 *   - Configurable Folder ID (stored in Script Properties)
 *   - All files in one Drive folder
 *   - resetAdmin endpoint
 *   - Roles: it_staff (super), it_manager, viewer  [admin=legacy alias for it_staff]
 *   - saveSysCfg: บันทึก email config, permissions, folder
 *   - getITUsers: ดึง IT Manager/Officer สำหรับ Email checklist
 *   - testFolder: ทดสอบ Folder ID ว่า GAS เข้าถึงได้
 *   - sendMail: ส่งอีเมล HTML ผ่าน MailApp (GAS account)
 *
 * Gmail scope required: run testSendMail() once in Apps Script editor
 * to authorize, then re-deploy as new version.
 */

/**
 * RUN THIS ONCE in Apps Script editor to authorize Gmail/MailApp scope:
 * Open Apps Script → Run → testSendMail → Grant permission
 */
function testSendMail() {
  MailApp.getRemainingDailyQuota(); // triggers OAuth consent for send_mail scope
  Logger.log('MailApp authorized. Remaining quota: ' + MailApp.getRemainingDailyQuota());
}

const F_USERS  = '_users.json';
const F_SESS   = '_sessions.json';
const F_TPL    = '_template.json';
const F_DEPTS  = '_depts.json';
const F_CFG    = '_config.json';   // system config incl. folderId, emailCfg, permissions

// ── FOLDER ────────────────────────────────────────────────────
function getFolder() {
  const props = PropertiesService.getScriptProperties();
  const fid   = props.getProperty('FOLDER_ID');
  if (fid) {
    try { return DriveApp.getFolderById(fid); } catch(e) {}
  }
  // fallback: named folder in My Drive
  const name = props.getProperty('FOLDER_NAME') || 'IT_Equipment_Manager';
  const it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  const nf = DriveApp.createFolder(name);
  nf.createFile('README.txt',
    'IT Equipment Manager Data Folder\nDo not delete or move files here.',
    MimeType.PLAIN_TEXT);
  return nf;
}

function setFolderId(fid) {
  PropertiesService.getScriptProperties().setProperty('FOLDER_ID', fid);
}

// ── DRIVE HELPERS ─────────────────────────────────────────────
function readJ(name, def) {
  const it = getFolder().getFilesByName(name);
  if (!it.hasNext()) return def;
  try { return JSON.parse(it.next().getBlob().getDataAsString('utf-8')); } catch { return def; }
}
function writeJ(name, data) {
  const f = getFolder(), s = JSON.stringify(data);
  const it = f.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(s);
  else f.createFile(name, s, MimeType.PLAIN_TEXT);
}
function deleteJ(name) {
  const it = getFolder().getFilesByName(name);
  if (it.hasNext()) it.next().setTrashed(true);
}

// ── HASH ──────────────────────────────────────────────────────
function hashPw(s) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
  );
}

// ── HTTP ──────────────────────────────────────────────────────
function doGet(e) {
  try {
    const p = e.parameter || {}, act = p.action || 'test';
    if (act==='test')        return R({ok:true,v:9,ts:new Date().toISOString(),
                                       folder:getFolder().getName()+'('+getFolder().getId().slice(0,8)+'...)'});
    if (act==='getDoc')      return R({doc:docGet(p.id)});
    if (act==='getTemplate') return R({tpl:readJ(F_TPL,null)});
    if (act==='getDepts')    return R({depts:readJ(F_DEPTS,[])});
    if (act==='getSysCfg')   return R({cfg:sysGet()});
    // getITUsers: public — returns IT roles for email checklist
    if (act==='getITUsers')  return R({users:usersAll().filter(u=>u.role==='it_staff'||u.role==='it_manager'||u.role==='admin')});
    // testFolder: verify a given folder ID is accessible
    if (act==='testFolder') {
      const fid = p.folderId || '';
      if (!fid) return R({error:'folderId required'});
      try {
        const folder = DriveApp.getFolderById(fid);
        return R({ok:true, folderName:folder.getName(), folderId:fid});
      } catch(fe) {
        return R({error:'Cannot access folder: '+fe.toString()});
      }
    }
    if (act==='resetAdmin')  { if(p.secret!=='reset2024')return R({error:'wrong secret'}); return R(resetAdmin()); }

    const u = sessCheck(p.token);
    if (act==='getDocs')      return R({docs:docsForUser(u)});
    if (act==='searchUsers')  return R({users:usersSearch(p.q||'')});
    if (act==='getUsers')     return R({users:(u.role==='admin'||u.role==='it_staff'||u.role==='it_manager')&&usersAll()});
    if (act==='exportAll')    return R(superUser(u)&&exportAll());
    return R({error:'unknown:'+act});
  } catch(ex) { return R({error:ex.toString()}); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents), act = b.action;
    if (act==='login')   return R(login(b.empId, b.pw));
    if (act==='signDoc') return R(docSign(b.docId, b.role, b.sig));

    const u = sessCheck(b.token);
    if (act==='saveDoc')      return R(canEdit(u) && docSave(b.doc));
    if (act==='updateDoc')    return R(canEdit(u) && docUpdate(b.id, b.patch));
    if (act==='deleteDoc')    return R(superUser(u) && docDel(b.id));
    if (act==='saveUser')     return R(superUser(u) && userSave(b.user));
    if (act==='delUser')      return R(superUser(u) && userDel(b.id));
    if (act==='saveTemplate') return R(superUser(u) && writeJ(F_TPL, b.tpl) || {ok:true});
    if (act==='saveDept')     return R(superUser(u) && deptSave(b.dept));
    if (act==='delDept')      return R(superUser(u) && deptDel(b.id));
    if (act==='saveSysCfg')   return R(superUser(u) && sysSave(b.cfg));
    if (act==='setFolderId')  return R(superUser(u) && (setFolderId(b.folderId), {ok:true}));
    if (act==='importAll')    return R(superUser(u) && importAll(b.data));
    if (act==='changePw')     return R(pwChange(u, b.oldPw, b.newPw));
    if (act==='sendMail')     return R(sendMail(b));
    return R({error:'unknown:'+act});
  } catch(ex) { return R({error:ex.toString()}); }
}

function R(d) {
  const o = ContentService.createTextOutput(JSON.stringify(d));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}

// ── SYSTEM CONFIG (folder, email, permissions) ────────────────
function sysGet() {
  const cfg = readJ(F_CFG, {});
  return {
    folderName:    cfg.folderName    || 'IT_Equipment_Manager',
    folderId:      PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '',
    ccEmails:      cfg.ccEmails      || 'bch.itsupport@glsict.com',
    orgName:       cfg.orgName       || 'Bangkok Christian Hospital',
    itOfficerIds:  cfg.itOfficerIds  || [],
    itManagerIds:  cfg.itManagerIds  || [],
    emailTemplates: cfg.emailTemplates || {},
    permissions:   cfg.permissions   || defaultPerms()
  };
}
function sysSave(cfg) {
  const existing = sysGet();
  const merged = {...existing, ...cfg};
  if (cfg.folderId !== undefined) setFolderId(cfg.folderId);
  writeJ(F_CFG, merged);
  return {ok:true};
}
function defaultPerms() {
  return {
    it_staff:   {viewDocs:true, createDoc:true, editDoc:true, deleteDoc:true, manageUsers:true, settings:true, template:true, importExport:true},
    admin:      {viewDocs:true, createDoc:true, editDoc:true, deleteDoc:true, manageUsers:true, settings:true, template:true, importExport:true},
    it_manager: {viewDocs:true, createDoc:false,editDoc:false,deleteDoc:false,manageUsers:false,settings:false,template:false,importExport:false},
    viewer:     {viewDocs:'own',createDoc:false,editDoc:false,deleteDoc:false,manageUsers:false,settings:false,template:false,importExport:false}
  };
}

// ── USERS ─────────────────────────────────────────────────────
function usersRaw() {
  let u = readJ(F_USERS, null);
  if (!u) {
    u = [
      {id:'itops',    empId:'itops',    name:'IT Operation & Support', dept:'IT', role:'it_staff',  email:'bch.itsupport@glsict.com', pw:hashPw('itops')},
      {id:'itmanager',empId:'itmanager',name:'IT Manager',             dept:'IT', role:'it_manager', email:'amnat.ki@glsict.com',      pw:hashPw('itmanager')}
    ];
    writeJ(F_USERS, u);
  }
  return u;
}
function usersAll()    { return usersRaw().map(u => ({...u, pw:undefined})); }
function usersSearch(q) {
  const lq = q.toLowerCase();
  return usersAll().filter(u => u.empId.toLowerCase().includes(lq)||u.name.toLowerCase().includes(lq)).slice(0,15);
}
function userSave(user) {
  const list = usersRaw(), i = list.findIndex(u => u.id===user.id);
  if (i>=0) { const pw=user.pw?hashPw(user.pw):list[i].pw; list[i]={...list[i],...user,pw}; }
  else       { user.id=user.empId; user.pw=hashPw(user.pw||user.empId); list.push(user); }
  writeJ(F_USERS, list); return {ok:true};
}
function userDel(id)   { writeJ(F_USERS, usersRaw().filter(u=>u.id!==id)); return {ok:true}; }
function resetAdmin()  {
  deleteJ(F_USERS); deleteJ(F_SESS);
  usersRaw(); // recreate defaults
  return {ok:true, msg:'Reset done. Login: admin/admin or itmanager/itmanager'};
}

// ── AUTH ──────────────────────────────────────────────────────
function login(empId, pw) {
  if (!empId||!pw) return {error:'กรุณากรอกข้อมูลให้ครบ'};
  const u = usersRaw().find(u=>u.empId===empId);
  if (!u)           return {error:'ไม่พบรหัสพนักงาน "'+empId+'"'};
  if (u.pw!==hashPw(pw)) return {error:'รหัสผ่านไม่ถูกต้อง'};
  const tok  = Utilities.base64Encode(Utilities.newBlob(empId+':'+Date.now()+':'+Math.random()).getBytes());
  const sess = readJ(F_SESS, {});
  sess[tok]  = {empId:u.empId, name:u.name, role:u.role, dept:u.dept, email:u.email||''};
  const keys = Object.keys(sess); if (keys.length>300) delete sess[keys[0]];
  writeJ(F_SESS, sess);
  return {token:tok, user:{empId:u.empId,name:u.name,role:u.role,dept:u.dept,email:u.email||'',id:u.id}};
}
function sessCheck(tok) {
  if (!tok) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const s = readJ(F_SESS,{})[tok];
  if (!s)   throw new Error('Session หมดอายุ กรุณา login ใหม่');
  return s;
}
// superUser: it_staff OR legacy admin role
function superUser(u) { if(u.role!=='admin'&&u.role!=='it_staff') throw new Error('ต้องเป็น IT Operation & Support'); return true; }
function adminOnly(u) { return superUser(u); } // backward-compat alias
function canEdit(u)   { if(u.role==='viewer'||u.role==='it_manager') throw new Error('ไม่มีสิทธิ์'); return true; }
function pwChange(u,oldPw,newPw) {
  const list=usersRaw(), i=list.findIndex(x=>x.empId===u.empId);
  if(i<0) throw new Error('ไม่พบผู้ใช้');
  if(list[i].pw!==hashPw(oldPw)) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  list[i].pw=hashPw(newPw); writeJ(F_USERS,list); return {ok:true};
}

// ── DOCS ──────────────────────────────────────────────────────
function docsAll() {
  const it=getFolder().getFiles(), docs=[];
  while(it.hasNext()) {
    const f=it.next(), n=f.getName();
    if(n.endsWith('.json')&&!n.startsWith('_')) {
      try{docs.push(JSON.parse(f.getBlob().getDataAsString('utf-8')));}catch{}
    }
  }
  return docs.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
}
function docsForUser(u) {
  const all=docsAll();
  return u.role==='viewer' ? all.filter(d=>d.hodEmpId===u.empId) : all;
}
function docGet(id) {
  if(!id) return null;
  const it=getFolder().getFilesByName(id+'.json');
  if(!it.hasNext()) return null;
  return JSON.parse(it.next().getBlob().getDataAsString('utf-8'));
}
function docSave(doc) {
  if(!doc||!doc.id) throw new Error('id required');
  const lk=LockService.getScriptLock(); lk.tryLock(20000);
  try {
    const s=JSON.stringify(doc), fn=doc.id+'.json';
    const it=getFolder().getFilesByName(fn);
    if(it.hasNext()) it.next().setContent(s);
    else getFolder().createFile(fn,s,MimeType.PLAIN_TEXT);
    return {ok:true,id:doc.id};
  } finally { lk.releaseLock(); }
}
function docUpdate(id,patch) {
  const doc=docGet(id); if(!doc) throw new Error('ไม่พบเอกสาร '+id);
  return docSave(Object.assign(doc,patch));
}
function docDel(id) {
  const it=getFolder().getFilesByName(id+'.json');
  if(!it.hasNext()) throw new Error('ไม่พบเอกสาร');
  it.next().setTrashed(true); return {ok:true};
}
function docSign(docId,role,sig) {
  const doc=docGet(docId); if(!doc) throw new Error('ไม่พบเอกสาร');
  if(!doc.sigs) doc.sigs={};
  doc.sigs[role]=sig;
  const sm={itOfficer:'pending_it_manager',itManager:'pending_recipient',recipient:'completed'};
  if(sm[role]) doc.status=sm[role];
  return docSave(doc);
}

// ── DEPARTMENTS ───────────────────────────────────────────────
function deptSave(dept) {
  const list=readJ(F_DEPTS,[]), i=list.findIndex(d=>d.id===dept.id);
  if(i>=0) list[i]={...list[i],...dept}; else list.push(dept);
  writeJ(F_DEPTS,list); return {ok:true};
}
function deptDel(id) { writeJ(F_DEPTS,readJ(F_DEPTS,[]).filter(d=>d.id!==id)); return {ok:true}; }

// ── IMPORT / EXPORT ───────────────────────────────────────────
function exportAll() {
  return {exported:new Date().toISOString(),docs:docsAll(),users:usersAll(),
          depts:readJ(F_DEPTS,[]),template:readJ(F_TPL,null),config:sysGet()};
}
function importAll(data) {
  if(!data) throw new Error('ไม่มีข้อมูล');
  let r={docs:0,users:0,depts:0};
  if(data.docs)  data.docs.forEach(d=>{try{docSave(d);r.docs++;}catch{}});
  if(data.users) { writeJ(F_USERS,data.users.map(u=>({...u,pw:u.pw||hashPw(u.empId)}))); r.users=data.users.length; }
  if(data.depts) { writeJ(F_DEPTS,data.depts); r.depts=data.depts.length; }
  if(data.template) writeJ(F_TPL,data.template);
  if(data.config)   writeJ(F_CFG,data.config);
  return {ok:true,...r};
}

// ── SEND EMAIL (via MailApp) ──────────────────────────────────
function sendMail(b) {
  const to = b.to || '';
  if (!to) throw new Error('ไม่มีอีเมลผู้รับ');
  const subject = b.subject || '[IT Equipment] แจ้งเตือน';
  const plainBody = b.body || '';
  const htmlBody = b.htmlBody || plainBody.replace(/\n/g,'<br>');

  // Build full HTML email
  const cfg = sysGet();
  const orgName = cfg.orgName || 'IT Department';
  const fullHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#1a5276;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:16px">&#128187; IT Equipment Manager</h2>
      <p style="margin:4px 0 0;font-size:12px;opacity:.8">${orgName}</p>
    </div>
    <div style="background:#fff;border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px;line-height:1.7">
      ${htmlBody}
    </div>
    <p style="font-size:10px;color:#999;margin-top:12px;text-align:center">ส่งจากระบบ IT Equipment Manager — ${new Date().toLocaleString('th-TH')}</p>
  </div>`;

  const options = { htmlBody: fullHtml, name: orgName + ' (IT Equipment)' };
  if (b.cc && b.cc.trim()) options.cc = b.cc;

  // Send to multiple recipients (split by comma)
  const toList = to.split(',').map(s=>s.trim()).filter(Boolean);
  toList.forEach(addr => {
    MailApp.sendEmail(addr, subject, plainBody, options);
  });

  // Log sent mail
  const log = readJ('_maillog.json', []);
  log.unshift({at:new Date().toISOString(),to,subject,sentBy:'GAS'});
  if(log.length>200) log.splice(200);
  writeJ('_maillog.json', log);

  return {ok:true, sent:toList.length};
}
