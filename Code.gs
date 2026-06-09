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
 * RUN THIS ONCE in Apps Script editor to authorize Gmail/MailApp & Triggers scope:
 * Open Apps Script → Run → testAuth → Grant permission
 */
function testAuth() {
  MailApp.getRemainingDailyQuota(); // triggers OAuth consent for send_mail scope
  ScriptApp.getProjectTriggers(); // triggers OAuth consent for ScriptApp
  Logger.log('Authorized! Remaining Mail quota: ' + MailApp.getRemainingDailyQuota());
}

const F_USERS  = '_users.json';
const F_SESS   = '_sessions.json';
const F_TPL    = '_template.json';
const F_DEPTS  = '_depts.json';
const F_CFG    = '_config.json';   // system config incl. folderId, emailCfg, permissions
const F_AUDIT  = '_audit.json';
const F_INVENTORY = '_inventory.json';
const F_BORROWS = '_borrows.json';

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
    if (act==='getAuditLogs') return R(superUser(u) && {logs: readJ(F_AUDIT, [])});
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
    if (act==='signDoc') return R((logAction({empId:'SYSTEM',name:'Signer',role:b.role}, 'signDoc', b.docId), docSign(b.docId, b.role, b.sig)));

    const u = sessCheck(b.token);
    if (act==='saveDoc')      return R(canEdit(u) && (logAction(u, 'saveDoc', b.doc?.id), docSave(b.doc)));
    if (act==='updateDoc')    return R(canEdit(u) && (logAction(u, 'updateDoc', b.id), docUpdate(b.id, b.patch)));
    if (act==='deleteDoc')    return R(superUser(u) && (logAction(u, 'deleteDoc', b.id), docDel(b.id)));
    if (act==='saveUser')     return R(superUser(u) && (logAction(u, 'saveUser', b.user?.empId), userSave(b.user)));
    if (act==='delUser')      return R(superUser(u) && (logAction(u, 'delUser', b.id), userDel(b.id)));
    if (act==='saveTemplate') return R(superUser(u) && (logAction(u, 'saveTemplate', ''), writeJ(F_TPL, b.tpl) || {ok:true}));
    if (act==='saveDept')     return R(superUser(u) && (logAction(u, 'saveDept', b.dept?.code), deptSave(b.dept)));
    if (act==='delDept')      return R(superUser(u) && (logAction(u, 'delDept', b.id), deptDel(b.id)));
    if (act==='saveSysCfg')   return R(superUser(u) && (logAction(u, 'saveSysCfg', ''), sysSave(b.cfg)));
    if (act==='setFolderId')  return R(superUser(u) && (logAction(u, 'setFolderId', b.folderId), setFolderId(b.folderId), {ok:true}));
    if (act==='importAll')    return R(superUser(u) && (logAction(u, 'importAll', ''), importAll(b.data)));
    if (act==='importUsersCSV') return R(superUser(u) && (logAction(u, 'importUsersCSV', ''), importUsersCSV(b.users)));
    if (act==='importDeptsCSV') return R(superUser(u) && (logAction(u, 'importDeptsCSV', ''), importDeptsCSV(b.depts)));
    if (act==='uploadImage')  return R(canEdit(u) && uploadImage(b.b64, b.name));
    if (act==='installReminderTrigger') return R(superUser(u) && (logAction(u, 'installReminderTrigger', ''), installReminderTrigger()));
    if (act==='getInventory') return R(canEdit(u) && {inventory: readJ(F_INVENTORY, [])});
    if (act==='saveInvItem')  return R(superUser(u) && (logAction(u, 'saveInvItem', b.item.id), saveInvItem(b.item)));
    if (act==='delInvItem')   return R(superUser(u) && (logAction(u, 'delInvItem', b.id), delInvItem(b.id)));
    if (act==='getBorrows')   return R(canEdit(u) && {borrows: readJ(F_BORROWS, [])});
    if (act==='saveBorrow')   return R(canEdit(u) && (logAction(u, 'saveBorrow', b.borrow.id), saveBorrow(b.borrow)));
    if (act==='changePw')     return R((logAction(u, 'changePw', ''), pwChange(u, b.oldPw, b.newPw)));
    if (act==='sendMail')     return R((logAction(u, 'sendMail', b.to), sendMail(b)));
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
function importUsersCSV(users) {
  const list = usersRaw();
  let added = 0, updated = 0;
  users.forEach(u => {
    const i = list.findIndex(x => x.empId === u.empId);
    if (i >= 0) {
      const pw = u.pw ? hashPw(u.pw) : list[i].pw;
      list[i] = {...list[i], ...u, pw};
      updated++;
    } else {
      u.id = u.id || u.empId;
      u.pw = hashPw(u.pw || u.empId);
      list.push(u);
      added++;
    }
  });
  writeJ(F_USERS, list); return {ok:true, added, updated};
}
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
function importDeptsCSV(depts) {
  const list = readJ(F_DEPTS,[]);
  let added = 0, updated = 0;
  depts.forEach(d => {
    const i = list.findIndex(x => x.code === d.code);
    if (i >= 0) { list[i] = {...list[i], ...d}; updated++; }
    else { d.id = d.id || d.code; list.push(d); added++; }
  });
  writeJ(F_DEPTS, list); return {ok:true, added, updated};
}

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

// ── UPLOAD IMAGE ──────────────────────────────────────────────
function uploadImage(b64, name) {
  try {
    const folder = getFolder();
    let imgFolder;
    const it = folder.getFoldersByName('Images');
    if(it.hasNext()) imgFolder = it.next();
    else imgFolder = folder.createFolder('Images');
    
    const parts = b64.split(',');
    const data = parts.length > 1 ? parts[1] : parts[0];
    let mime = 'image/jpeg';
    if(parts.length > 1) {
      const m = parts[0].match(/:(.*?);/);
      if(m) mime = m[1];
    }
    
    const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name || ('img_'+Date.now()));
    const file = imgFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {ok:true, url: 'https://drive.google.com/uc?export=view&id=' + file.getId()};
  } catch(e) {
    throw new Error('Upload failed: ' + e.toString());
  }
}

// ── AUDIT LOG ─────────────────────────────────────────────────
function logAction(u, action, details) {
  try {
    const lk = LockService.getScriptLock();
    if(lk.tryLock(5000)) {
      const logs = readJ(F_AUDIT, []);
      logs.unshift({
        ts: new Date().toISOString(),
        uId: u ? u.empId : 'SYSTEM',
        uNm: u ? u.name : 'System',
        role: u ? u.role : '',
        act: action,
        det: details || ''
      });
      if(logs.length > 500) logs.length = 500;
      writeJ(F_AUDIT, logs);
      lk.releaseLock();
    }
  } catch(e) {}
}

// ── AUTO REMINDER ─────────────────────────────────────────────
function installReminderTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => { if(t.getHandlerFunction() === 'dailyReminders') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('dailyReminders').timeBased().everyDays(1).atHour(8).create();
    return {ok:true};
  } catch(e) {
    throw new Error("Trigger setup failed: " + e.message + " (Please run testAuth in Apps Script editor first)");
  }
}

function dailyReminders() {
  try {
    const cfg = readJ(F_CFG, {});
    const rCfg = cfg.reminder || {};
    if(!rCfg.enabled || !rCfg.days) return;
    
    const daysThres = parseInt(rCfg.days, 10);
    const now = Date.now();
    const docs = readJ('IT_Equipment_Docs.json', {docs:[]}).docs || [];
    const pendDocs = docs.filter(d => ['pending_it_officer','pending_it_manager','pending_recipient'].includes(d.status));
    
    let remindMap = {};
    const allUsers = readJ(F_USERS, []);
    
    pendDocs.forEach(d => {
      const ageMs = now - new Date(d.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if(ageDays >= daysThres) {
        let emails = [];
        if(d.status === 'pending_it_officer') {
          emails = allUsers.filter(u=>u.role==='it_staff'||u.role==='admin').map(u=>u.email).filter(Boolean);
        } else if(d.status === 'pending_it_manager') {
          const itManagerIds = cfg.itManagerIds || [];
          emails = allUsers.filter(u=>itManagerIds.includes(u.empId)).map(u=>u.email).filter(Boolean);
        } else if(d.status === 'pending_recipient') {
          const hod = allUsers.find(u=>u.empId === d.hodEmpId);
          if(hod && hod.email) emails.push(hod.email);
        }
        
        emails.forEach(email => {
          if(!remindMap[email]) remindMap[email] = [];
          remindMap[email].push(d);
        });
      }
    });
    
    const orgName = cfg.orgName || 'IT Department';
    const appUrl = ScriptApp.getService().getUrl() || ''; // get the web app url
    
    for(const email in remindMap) {
      const dlist = remindMap[email];
      const subj = `[Reminder] มีเอกสารรอให้คุณพิจารณาลงนาม ${dlist.length} รายการ`;
      let body = `เรียน ท่านผู้ใช้งาน\n\nระบบ IT Equipment Manager ตรวจพบเอกสารที่รอการลงนามจากท่านจำนวน ${dlist.length} รายการ ดังนี้:\n\n`;
      let htmlBody = `<div style="font-family:sans-serif;color:#333"><p>เรียน ท่านผู้ใช้งาน,</p><p>ระบบ <strong>IT Equipment Manager</strong> ตรวจพบเอกสารที่รอการลงนามจากท่านจำนวน ${dlist.length} รายการ ดังนี้:</p><ul>`;
      
      dlist.forEach(d => {
        body += `- เอกสาร ${d.id} (ชื่อผู้ครอบครอง: ${d.name})\n`;
        htmlBody += `<li>เอกสาร <strong>${d.id}</strong> (ชื่อผู้ครอบครอง: ${d.name})</li>`;
      });
      
      body += `\nกรุณาเข้าสู่ระบบเพื่อดำเนินการ: ${appUrl}\n\nขอบคุณ\n${orgName}`;
      htmlBody += `</ul><p>กรุณาเข้าสู่ระบบเพื่อดำเนินการ: <a href="${appUrl}">ไปที่ระบบ</a></p><p>ขอบคุณ<br>${orgName}</p></div>`;
      
      MailApp.sendEmail({ to: email, subject: subj, body: body, htmlBody: htmlBody });
    }
  } catch(e) {
    console.error("dailyReminders failed:", e);
  }
}

// ── BORROWING SYSTEM (INVENTORY) ──────────────────────────────
function saveInvItem(item) {
  const lk = LockService.getScriptLock();
  if(!lk.tryLock(5000)) throw new Error('System busy');
  try {
    let inv = readJ(F_INVENTORY, []);
    if(item.id) {
      const idx = inv.findIndex(i => i.id === item.id);
      if(idx >= 0) inv[idx] = {...inv[idx], ...item};
      else inv.push(item);
    } else {
      item.id = 'INV-' + Date.now();
      item.status = item.status || 'available';
      inv.push(item);
    }
    writeJ(F_INVENTORY, inv);
    return {ok:true, item};
  } finally { lk.releaseLock(); }
}

function delInvItem(id) {
  const lk = LockService.getScriptLock();
  if(!lk.tryLock(5000)) throw new Error('System busy');
  try {
    let inv = readJ(F_INVENTORY, []);
    inv = inv.filter(i => i.id !== id);
    writeJ(F_INVENTORY, inv);
    return {ok:true};
  } finally { lk.releaseLock(); }
}

// ── BORROWING SYSTEM (RECORDS) ────────────────────────────────
function saveBorrow(borrow) {
  const lk = LockService.getScriptLock();
  if(!lk.tryLock(5000)) throw new Error('System busy');
  try {
    let borrows = readJ(F_BORROWS, []);
    let inv = readJ(F_INVENTORY, []);
    
    if(!borrow.id) {
      borrow.id = 'BRW-' + Date.now();
      borrow.createdAt = new Date().toISOString();
      borrow.status = borrow.status || 'active';
      borrows.push(borrow);
      
      // Update inventory status to 'borrowed'
      const invIdx = inv.findIndex(i => i.id === borrow.invId);
      if(invIdx >= 0) {
        inv[invIdx].status = 'borrowed';
        writeJ(F_INVENTORY, inv);
      }
    } else {
      const idx = borrows.findIndex(b => b.id === borrow.id);
      if(idx >= 0) {
        const oldBrw = borrows[idx];
        borrows[idx] = {...oldBrw, ...borrow};
        
        // If it was returned just now
        if(oldBrw.status !== 'returned' && borrow.status === 'returned') {
          const invIdx = inv.findIndex(i => i.id === borrow.invId);
          if(invIdx >= 0) {
            inv[invIdx].status = 'available'; // back to available
            writeJ(F_INVENTORY, inv);
          }
        }
      } else {
        borrows.push(borrow);
      }
    }
    
    writeJ(F_BORROWS, borrows);
    return {ok:true, borrow};
  } finally { lk.releaseLock(); }
}
