const Audit = {
  logs: [],
  
  async loadLogs() {
    A.load('กำลังโหลดประวัติการใช้งาน...');
    try {
      // It's a GET request in Code.gs: `if (act==='getAuditLogs') return R(...)`
      // Wait, in Code.gs I put it under `doGet`. Let's check Code.gs!
      // I added: `if (act==='getAuditLogs') return R(superUser(u) && {logs: readJ(F_AUDIT, [])});`
      // So I should use GAS.get!
      const res = await GAS.get('getAuditLogs');
      this.logs = res.logs || [];
      this.render();
    } catch(ex) {
      A.toast('โหลด Audit Log ไม่สำเร็จ: ' + ex.message, 'err');
    } finally {
      A.unload();
    }
  },

  render() {
    const tb = document.getElementById('audit-tb');
    if(!tb) return;
    if(!this.logs.length) {
      tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink3);padding:20px">ไม่มีประวัติการใช้งาน</td></tr>';
      return;
    }
    
    // Map actions to Thai descriptions
    const actMap = {
      'login': 'เข้าสู่ระบบ',
      'signDoc': 'ลงนามเอกสาร',
      'saveDoc': 'สร้าง/บันทึกเอกสาร',
      'updateDoc': 'อัปเดตเอกสาร',
      'deleteDoc': 'ลบเอกสาร',
      'saveUser': 'บันทึกผู้ใช้',
      'delUser': 'ลบผู้ใช้',
      'saveTemplate': 'บันทึก Template',
      'saveDept': 'บันทึกแผนก',
      'delDept': 'ลบแผนก',
      'saveSysCfg': 'ตั้งค่าระบบ',
      'setFolderId': 'เปลี่ยน Folder ID',
      'importAll': 'นำเข้าข้อมูลทั้งหมด',
      'importUsersCSV': 'นำเข้าผู้ใช้งาน (CSV)',
      'importDeptsCSV': 'นำเข้าแผนก (CSV)',
      'changePw': 'เปลี่ยนรหัสผ่าน',
      'sendMail': 'ส่งอีเมล'
    };

    tb.innerHTML = this.logs.map(log => {
      const dt = new Date(log.ts).toLocaleString('th-TH');
      const act = actMap[log.act] || log.act;
      return `<tr>
        <td style="font-size:11px;color:var(--ink3)">${dt}</td>
        <td><strong>${log.uNm||'System'}</strong><br><span style="font-size:10px;color:var(--ink3)">${log.uId}</span></td>
        <td style="font-size:11px">${log.role||'-'}</td>
        <td><span style="display:inline-block;padding:2px 6px;background:var(--prim);color:var(--pri);border-radius:4px;font-size:10px">${act}</span></td>
        <td style="font-size:11px;word-break:break-all">${log.det||'-'}</td>
      </tr>`;
    }).join('');
  }
};
