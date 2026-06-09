const INV = {
  inventory: [],
  borrows: [],
  curTab: 'list',
  
  async loadData() {
    A.load('กำลังโหลดข้อมูลคลัง...');
    try {
      const [invRes, brwRes] = await Promise.all([
        GAS.get('getInventory'),
        GAS.get('getBorrows')
      ]);
      this.inventory = invRes.inventory || [];
      this.borrows = brwRes.borrows || [];
      this.render();
    } catch(e) {
      A.toast('โหลดข้อมูลล้มเหลว', 'err');
    } finally {
      A.unload();
    }
  },

  tab(t) {
    this.curTab = t;
    ['list','borrows'].forEach(x => {
      const b = document.getElementById('itab-'+x);
      const p = document.getElementById('ipane-'+x);
      if(b) b.className = 'ecfg-tab' + (t===x ? ' on' : '');
      if(p) p.className = 'ecfg-pane' + (t===x ? ' on' : '');
    });
    this.render();
  },

  render() {
    if(this.curTab === 'list') this.renderInv();
    else this.renderBorrows();
  },

  renderInv() {
    const tb = document.getElementById('inv-tb');
    if(!tb) return;
    if(!this.inventory.length) {
      tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink3);padding:20px">ไม่มีอุปกรณ์ในระบบ</td></tr>';
      return;
    }
    tb.innerHTML = this.inventory.map(item => {
      let stHtml = '';
      if(item.status === 'available') stHtml = '<span class="bdg bgg">Available</span>';
      else if(item.status === 'borrowed') stHtml = '<span class="bdg bgb">Borrowed</span>';
      else stHtml = '<span class="bdg ba">Maintenance</span>';
      
      const canBrw = item.status === 'available';
      
      return `<tr>
        <td style="font-size:11px;font-family:monospace">${item.id}</td>
        <td><strong>${item.name}</strong><div style="font-size:10px;color:var(--ink3)">${item.note||'-'}</div></td>
        <td style="font-size:11px">${item.brand||'-'} / ${item.model||'-'}</td>
        <td style="font-size:11px">${item.serial||'-'}</td>
        <td>${stHtml}</td>
        <td>
          <button class="btn bh bsm" onclick="INV.openInvM('${item.id}')">&#9997;</button>
          ${canBrw ? `<button class="btn bp bsm" onclick="INV.openBrwM('${item.id}')">ให้ยืม</button>` : ''}
          <button class="btn bh bsm" style="color:var(--red)" onclick="INV.delInv('${item.id}')">&#128465;</button>
        </td>
      </tr>`;
    }).join('');
  },

  renderBorrows() {
    const tb = document.getElementById('brw-tb');
    if(!tb) return;
    
    // Sort borrows by created desc
    const sorted = [...this.borrows].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if(!sorted.length) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink3);padding:20px">ไม่มีประวัติการยืม</td></tr>';
      return;
    }
    
    tb.innerHTML = sorted.map(b => {
      const inv = this.inventory.find(i => i.id === b.invId);
      const invName = inv ? inv.name : b.invId;
      const d = new Date(b.createdAt).toLocaleDateString('th-TH');
      const due = b.expectedReturnDate ? new Date(b.expectedReturnDate).toLocaleDateString('th-TH') : '-';
      
      let stHtml = b.status === 'active' ? '<span class="bdg bgb">กำลังยืม</span>' : '<span class="bdg bgg">คืนแล้ว</span>';
      
      return `<tr>
        <td style="font-size:11px">${d}</td>
        <td style="font-size:10px;font-family:monospace;color:var(--ink3)">${b.id}</td>
        <td style="font-size:11px"><strong>${invName}</strong></td>
        <td><div style="font-size:12px;font-weight:600">${b.borrowerName}</div><div style="font-size:10px;color:var(--ink3)">${b.dept}</div></td>
        <td style="font-size:11px">${due}</td>
        <td>${stHtml}</td>
        <td>
          ${b.status === 'active' ? `<button class="btn bp bsm" onclick="INV.openRetM('${b.id}')">&#8617; รับคืน</button>` : `<span style="font-size:10px;color:var(--ink3)">${b.note||''}</span>`}
        </td>
      </tr>`;
    }).join('');
  },

  // ── INVENTORY MODAL ──
  openInvM(id) {
    let it = {name:'', brand:'', model:'', serial:'', status:'available', note:''};
    if(id) {
      const found = this.inventory.find(i => i.id === id);
      if(found) it = found;
    }
    document.getElementById('invm-t').textContent = id ? 'แก้ไขเครื่องสำรอง' : 'เพิ่มเครื่องสำรอง';
    document.getElementById('inv-id').value = id || '';
    document.getElementById('inv-n').value = it.name;
    document.getElementById('inv-b').value = it.brand;
    document.getElementById('inv-m').value = it.model;
    document.getElementById('inv-s').value = it.serial;
    document.getElementById('inv-st').value = it.status;
    document.getElementById('inv-note').value = it.note;
    document.getElementById('m-inv').style.display = 'flex';
  },
  closeInvM() { document.getElementById('m-inv').style.display = 'none'; },
  
  async saveInv() {
    const item = {
      id: document.getElementById('inv-id').value,
      name: document.getElementById('inv-n').value.trim(),
      brand: document.getElementById('inv-b').value.trim(),
      model: document.getElementById('inv-m').value.trim(),
      serial: document.getElementById('inv-s').value.trim(),
      status: document.getElementById('inv-st').value,
      note: document.getElementById('inv-note').value.trim()
    };
    if(!item.name) return A.toast('กรุณาระบุชื่ออุปกรณ์', 'err');
    
    A.load('กำลังบันทึก...');
    try {
      const res = await GAS.post({action: 'saveInvItem', item});
      if(item.id) {
        const idx = this.inventory.findIndex(i => i.id === item.id);
        if(idx>=0) this.inventory[idx] = res.item;
      } else {
        this.inventory.push(res.item);
      }
      this.closeInvM();
      this.render();
      A.toast('บันทึกสำเร็จ', 'ok');
    } catch(e) { A.toast(e.message, 'err'); }
    finally { A.unload(); }
  },
  
  async delInv(id) {
    if(!confirm('ยืนยันลบอุปกรณ์นี้?')) return;
    A.load('กำลังลบ...');
    try {
      await GAS.post({action: 'delInvItem', id});
      this.inventory = this.inventory.filter(i => i.id !== id);
      this.render();
      A.toast('ลบสำเร็จ', 'ok');
    } catch(e) { A.toast(e.message, 'err'); }
    finally { A.unload(); }
  },

  // ── BORROW MODAL ──
  openBrwM(invId) {
    const inv = this.inventory.find(i => i.id === invId);
    if(!inv) return;
    document.getElementById('brw-inv-id').value = invId;
    document.getElementById('brw-inv-name').textContent = inv.name;
    document.getElementById('brw-inv-desc').textContent = `${inv.brand||'-'} ${inv.model||'-'} | SN: ${inv.serial||'-'}`;
    
    this.clrUser();
    document.getElementById('brw-due').value = '';
    document.getElementById('brw-note').value = '';
    document.getElementById('m-brw').style.display = 'flex';
  },
  closeBrwM() { document.getElementById('m-brw').style.display = 'none'; },
  
  // User Search logic inside Borrow modal
  srchTmr: null,
  searchUser() {
    clearTimeout(this.srchTmr);
    const q = document.getElementById('brw-u-q').value.trim().toLowerCase();
    const dd = document.getElementById('brw-u-dd');
    if(q.length < 1) { dd.classList.remove('on'); return; }
    
    this.srchTmr = setTimeout(() => {
      const matches = (A.users||[]).filter(u => 
        (u.name||'').toLowerCase().includes(q) || (u.empId||'').toLowerCase().includes(q)
      ).slice(0, 5);
      if(!matches.length) { dd.innerHTML='<div class="hi" style="color:var(--ink3)">ไม่พบผู้ใช้</div>'; dd.classList.add('on'); return; }
      dd.innerHTML = matches.map(u => 
        `<div class="hi" onclick="INV.selUser('${u.empId}','${u.name.replace(/'/g,"\\'")}','${u.dept||''}')">` +
        `<div class="hn">${u.name}</div><div class="hm">${u.empId} | ${u.dept||'-'}</div></div>`
      ).join('');
      dd.classList.add('on');
    }, 250);
  },
  selUser(empId, name, dept) {
    document.getElementById('brw-emp-id').value = empId;
    document.getElementById('brw-emp-name').value = name;
    document.getElementById('brw-emp-dept').value = dept;
    document.getElementById('brw-u-n').textContent = name;
    document.getElementById('brw-u-e').textContent = empId;
    document.getElementById('brw-u-sel').style.display = 'flex';
    document.getElementById('brw-u-q').style.display = 'none';
    document.getElementById('brw-u-dd').classList.remove('on');
  },
  clrUser() {
    document.getElementById('brw-emp-id').value = '';
    document.getElementById('brw-u-sel').style.display = 'none';
    document.getElementById('brw-u-q').style.display = '';
    document.getElementById('brw-u-q').value = '';
    document.getElementById('brw-u-dd').classList.remove('on');
  },

  async saveBorrow() {
    const invId = document.getElementById('brw-inv-id').value;
    const empId = document.getElementById('brw-emp-id').value;
    if(!empId) return A.toast('กรุณาระบุผู้ยืม', 'err');
    
    const borrow = {
      invId,
      borrowerEmpId: empId,
      borrowerName: document.getElementById('brw-emp-name').value,
      dept: document.getElementById('brw-emp-dept').value,
      expectedReturnDate: document.getElementById('brw-due').value,
      note: document.getElementById('brw-note').value.trim()
    };
    
    A.load('กำลังบันทึก...');
    try {
      const res = await GAS.post({action: 'saveBorrow', borrow});
      this.borrows.push(res.borrow);
      const invIdx = this.inventory.findIndex(i => i.id === invId);
      if(invIdx>=0) this.inventory[invIdx].status = 'borrowed';
      this.closeBrwM();
      this.render();
      A.toast('บันทึกการยืมสำเร็จ', 'ok');
    } catch(e) { A.toast(e.message, 'err'); }
    finally { A.unload(); }
  },

  // ── RETURN MODAL ──
  openRetM(brwId) {
    document.getElementById('brw-ret-id').value = brwId;
    document.getElementById('brw-ret-note').value = '';
    document.getElementById('m-brw-ret').style.display = 'flex';
  },
  closeRetM() { document.getElementById('m-brw-ret').style.display = 'none'; },
  
  async confirmReturn() {
    const brwId = document.getElementById('brw-ret-id').value;
    const note = document.getElementById('brw-ret-note').value.trim();
    
    const borrow = this.borrows.find(b => b.id === brwId);
    if(!borrow) return;
    
    const update = {
      ...borrow,
      status: 'returned',
      actualReturnDate: new Date().toISOString(),
      note: borrow.note ? borrow.note + ' | คืน: ' + note : note
    };
    
    A.load('กำลังบันทึก...');
    try {
      const res = await GAS.post({action: 'saveBorrow', borrow: update});
      const idx = this.borrows.findIndex(b => b.id === brwId);
      if(idx>=0) this.borrows[idx] = res.borrow;
      
      const invIdx = this.inventory.findIndex(i => i.id === borrow.invId);
      if(invIdx>=0) this.inventory[invIdx].status = 'available';
      
      this.closeRetM();
      this.render();
      A.toast('รับคืนสำเร็จ', 'ok');
    } catch(e) { A.toast(e.message, 'err'); }
    finally { A.unload(); }
  }
};
