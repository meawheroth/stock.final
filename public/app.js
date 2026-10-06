
const S={available:['พร้อมใช้งาน','--ok'],borrowed:['ถูกยืม','--bo'],broken:['เสีย','--br'],damaged:['ชำรุด','--da'],lost:['สูญหาย','--lo']};
const KEYS=Object.keys(S),$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[],kind='asset',editId=null,moveId=null,img='';
let token=localStorage.getItem('stockToken')||'',user=null,loans=[],returnTarget=null,registerMode=false;
const api=async(u,m='GET',b)=>{const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const r=await fetch('/api'+u,{method:m,headers,body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'เกิดข้อผิดพลาด');return d};
const load=async()=>{if(!token)return;try{items=await api('/items');render()}catch(e){$('list').innerHTML='<div class="empty" style="grid-column:1/-1">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: '+esc(e.message)+'</div>'}};
const stat=i=>{const a=i.st.available;return a<=0?['out','หมด','--br']:a<=i.total*.2?['low','เหลือน้อย','--bo']:['ok','พร้อมใช้งาน','--ok']};


function render(){
  const all=items.filter(i=>i.kind===kind);
  const t={total:0};KEYS.forEach(k=>t[k]=0);
  all.forEach(i=>{t.total+=i.total;KEYS.forEach(k=>t[k]+=i.st[k])});
  $('sum').innerHTML=`<div class="sc"><b>${all.length}</b><span>รายการ</span></div><div class="sc"><b>${t.total}</b><span>ทั้งหมด</span></div>`+KEYS.map(k=>`<div class="sc"><b style="color:var(${S[k][1]})">${t[k]}</b><span>${S[k][0]}</span></div>`).join('');
  const q=$('q').value.trim().toLowerCase(),f=$('fs').value;
  const v=all.filter(i=>(!q||(i.code+i.name+i.cat).toLowerCase().includes(q))&&(!f||stat(i)[0]===f));
  $('list').innerHTML=v.length?v.map(i=>{const s=stat(i);return `<div class="it"><div class="im">${i.img?`<img src="${esc(i.img)}" alt="">`:(i.kind==='asset'?'🖥️':'🧴')}</div><div class="bd">
  <div><div class="nm">${esc(i.name)}</div><div class="mt">${esc(i.code)} · ${esc(i.cat)}</div></div>
  <div><span class="badge" style="background:var(${s[2]})">${s[1]}</span> <span class="mt">คงเหลือ ${i.st.available}/${i.total}</span></div>
  <div class="stk">${KEYS.map(k=>`<div style="width:${i.total?i.st[k]/i.total*100:0}%;background:var(${S[k][1]})"></div>`).join('')}</div>
  <div class="st">${KEYS.map(k=>`<div><b style="color:var(${S[k][1]})">${i.st[k]}</b>${S[k][0]}</div>`).join('')}</div>
  ${i.desc?`<div class="mt">${esc(i.desc)}</div>`:''}
  ${user?.role==='admin'?`<div class="ac"><button class="btn p" data-a="mv" data-id="${i.id}">ย้ายสถานะ</button><button class="btn" data-a="ed" data-id="${i.id}">แก้ไข</button><button class="btn d" data-a="del" data-id="${i.id}">ลบ</button></div>`:''}</div></div>`}).join(''):'<div class="empty" style="grid-column:1/-1">ไม่พบรายการ</div>';
}

function calcAvail(){
  const n=id=>Math.max(0,parseInt($(id).value)||0);
  const a=n('ft')-n('fb')-n('fr')-n('fd')-n('fl');
  $('fa').innerHTML=`จำนวนคงเหลือ (พร้อมใช้งาน): <b style="color:var(${a<0?'--br':'--ok'})">${a}</b> (คำนวณอัตโนมัติ)`;
  return a;
}
function openForm(id){
  editId=id;const i=items.find(x=>x.id===id);img=i?i.img:'';
  $('fT').textContent=i?'แก้ไขรายการ':'เพิ่มรายการ';
  $('fk').value=i?i.kind:kind;$('fc').value=i?i.code:nextCode(kind);$('fn').value=i?i.name:'';
  $('fy').value=i?i.cat:'';$('ft').value=i?i.total:'';
  $('fb').value=i?i.st.borrowed:0;$('fr').value=i?i.st.broken:0;$('fd').value=i?i.st.damaged:0;$('fl').value=i?i.st.lost:0;
  $('fx').value=i?i.desc:'';$('fi').value='';$('fe').textContent='';
  $('pv').src=img;$('pv').style.display=img?'block':'none';
  calcAvail();$('ovF').classList.add('on');
}
function nextCode(k){const p=k==='asset'?'EQ-':'SP-';const m=items.filter(i=>i.code.startsWith(p)).map(i=>parseInt(i.code.slice(3))||0);return p+String((m.length?Math.max(...m):0)+1).padStart(3,'0')}

$('fk').onchange=()=>{if(!editId)$('fc').value=nextCode($('fk').value)};
['ft','fb','fr','fd','fl'].forEach(id=>$(id).oninput=calcAvail);
$('fi').onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{
    const s=Math.min(1,360/Math.max(im.width,im.height)),c=document.createElement('canvas');
    c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    img=c.toDataURL('image/jpeg',.7);$('pv').src=img;$('pv').style.display='block'};im.src=r.result};r.readAsDataURL(file);
};
$('save').onclick=async()=>{
  const n=id=>Math.max(0,parseInt($(id).value)||0),code=$('fc').value.trim(),name=$('fn').value.trim(),a=calcAvail();
  const err=m=>$('fe').textContent=m;
  if(!code||!name)return err('กรุณากรอกรหัสและชื่ออุปกรณ์');
  if(items.some(i=>i.code===code&&i.id!==editId))return err('รหัสนี้ถูกใช้แล้ว');
  if(!n('ft'))return err('กรุณากรอกจำนวนทั้งหมด');
  if(a<0)return err('ผลรวมของสถานะอื่นเกินจำนวนทั้งหมด');
  const d={kind:$('fk').value,code,name,cat:$('fy').value.trim()||'ทั่วไป',total:n('ft'),
    st:{available:a,borrowed:n('fb'),broken:n('fr'),damaged:n('fd'),lost:n('fl')},img,desc:$('fx').value.trim()};
  try{await(editId?api('/items/'+editId,'PUT',d):api('/items','POST',d))}catch(e){return err(e.message)}
  kind=d.kind;syncTabs();await load();$('ovF').classList.remove('on');
};

function openMove(id){
  moveId=id;const i=items.find(x=>x.id===id);
  const o=KEYS.filter(k=>k!=='borrowed').map(k=>`<option value="${k}">${S[k][0]}</option>`).join('');
  $('mf').innerHTML=o;$('mt').innerHTML=o;$('mf').value='available';$('mt').value='broken';
  $('mT').textContent='ย้ายสถานะ: '+i.name;$('mq').value=1;$('mn').value='';$('me').textContent='';
  logView(i);$('ovM').classList.add('on');
}
const logView=i=>$('mlg').innerHTML=i.log.length?i.log.slice().reverse().map(l=>`${esc(l)}<br>`).join(''):'ยังไม่มีประวัติการเปลี่ยนแปลง';
$('mgo').onclick=async()=>{
  const i=items.find(x=>x.id===moveId),f=$('mf').value,t=$('mt').value,q=parseInt($('mq').value)||0;
  if(f===t)return $('me').textContent='เลือกสถานะต้นทางและปลายทางให้ต่างกัน';
  if(q<1||q>i.st[f])return $('me').textContent=`จำนวนไม่ถูกต้อง (${S[f][0]}มี ${i.st[f]})`;
  try{await api('/items/'+moveId+'/move','POST',{from:f,to:t,qty:q,note:$('mn').value})}catch(e){return $('me').textContent=e.message}
  await load();logView(items.find(x=>x.id===moveId));$('me').textContent='';$('mn').value='';
};

function syncTabs(){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.k===kind))}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{kind=b.dataset.k;syncTabs();render()});
document.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>$(b.dataset.x).classList.remove('on'));
$('add').onclick=()=>openForm(null);$('q').oninput=render;$('fs').onchange=render;
$('list').onclick=async e=>{
  const b=e.target.closest('[data-a]');if(!b)return;const id=b.dataset.id;
  if(b.dataset.a==='ed')openForm(id);
  else if(b.dataset.a==='mv')openMove(id);
  else if(confirm('ต้องการลบรายการนี้หรือไม่?')){try{await api('/items/'+id,'DELETE');await load()}catch(e){alert(e.message)}}
};


function showPage(name){document.querySelectorAll('.page').forEach(p=>p.hidden=true);$(name+'Page').hidden=false;document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('on',b.dataset.page===name));if(name==='loans')loadLoans();if(name==='dashboard')loadDashboard();if(name==='users')loadUsers()}
function showApp(){ $('loginBox').style.display=token?'none':'flex';document.querySelector('.wrap').style.display=token?'block':'none';if(!token)return;
  $('userLabel').textContent=user.name+' · '+({admin:'Admin',teacher:'อาจารย์',student:'นักศึกษา'}[user.role]||'');
  $('usersTab').hidden=user.role!=='admin';$('newLoan').hidden=user.role!=='student';$('add').hidden=user.role!=='admin';
  showPage('dashboard');load();
}
function authError(message){$('loginError').textContent=message}
$('registerButton').onclick=()=>{registerMode=!registerMode;$('registerFields').hidden=!registerMode;$('loginTitle').textContent=registerMode?'ลงทะเบียนนักศึกษา':'เข้าสู่ระบบ';$('loginButton').textContent=registerMode?'สร้างบัญชี':'เข้าสู่ระบบ';$('registerButton').textContent=registerMode?'กลับไปเข้าสู่ระบบ':'ลงทะเบียนนักศึกษา';$('loginError').textContent=''};
$('loginButton').onclick=async()=>{authError('');try{let data;if(registerMode)data=await api('/auth/register','POST',{name:$('regName').value,studentId:$('regId').value,department:$('regDept').value,phone:$('regPhone').value,email:$('loginEmail').value,password:$('loginPassword').value});else data=await api('/auth/login','POST',{email:$('loginEmail').value,password:$('loginPassword').value});token=data.token;user=data.user;localStorage.setItem('stockToken',token);showApp()}catch(e){authError(e.message)}};
$('logout').onclick=()=>{token='';user=null;localStorage.removeItem('stockToken');showApp()};
document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));


async function loadLoans(){if(!token)return;try{loans=await api('/loans');drawLoans();}catch(e){$('loanList').innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
function isSupplyOnly(loan){return loan.items?.length>0&&loan.items.every(row=>row.kind==='supply')}
function statusText(loan){if(loan.overdue)return 'เกินกำหนด';if(loan.status==='dispensed'||(loan.status==='returned'&&isSupplyOnly(loan)))return 'เบิกจ่ายแล้ว';return ({pending:'รออนุมัติ',approved:'กำลังยืม',returned:'คืนครบแล้ว',rejected:'ไม่อนุมัติ'}[loan.status]||loan.status)}
function loanCard(loan){const borrower=loan.borrower?.name||'ผู้ยืม';const rows=loan.items.map(row=>`<div class="loanItem"><span>${esc(row.name)} <span class="mt">(${esc(row.code)})</span></span><span>${row.returned||0}/${row.quantity} ชิ้น${row.kind==='supply'?' · ใช้ไป':''}</span>${loan.status==='approved'&&user.role==='admin'&&row.kind==='asset'&&row.returned<row.quantity?`<button class="btn" data-return="${loan.id}" data-item="${row.itemId}" data-name="${esc(row.name)}" data-left="${row.quantity-row.returned}">รับคืน</button>`:''}</div>`).join('');
  const adminButtons=loan.status==='pending'&&user.role==='admin'?`<button class="btn p" data-decision="approved" data-id="${loan.id}">อนุมัติ</button><button class="btn" data-decision="rejected" data-id="${loan.id}">ไม่อนุมัติ</button>`:'';
  return `<article class="loanCard"><div class="loanTop"><div><h3>${esc(loan.project)}</h3><div class="mt">${esc(borrower)} · ${esc(loan.group||'ไม่ระบุกลุ่ม')} · ${esc(loan.purpose)}</div></div><span class="loanBadge ${loan.overdue?'late':loan.status}">${statusText(loan)}</span></div><div class="loanDates">วันที่ยืม ${new Date(loan.borrowDate).toLocaleDateString('th-TH')} · กำหนดคืน ${new Date(loan.dueDate).toLocaleDateString('th-TH')}</div><div class="loanItems">${rows}</div>${loan.adminNote?`<p class="mt">หมายเหตุ Admin: ${esc(loan.adminNote)}</p>`:''}<div class="history">${(loan.history||[]).map(esc).join(' · ')}</div><div class="loanActions">${adminButtons}</div></article>`}
function drawLoans(){const filter=$('loanFilter').value;const rows=loans.filter(l=>!filter||(filter==='overdue'?l.overdue:filter==='dispensed'?(l.status==='dispensed'||(l.status==='returned'&&isSupplyOnly(l))):filter==='returned'?(l.status==='returned'&&!isSupplyOnly(l)):l.status===filter));$('loanList').innerHTML=rows.length?rows.map(loanCard).join(''):'<div class="empty">ยังไม่มีรายการยืม</div>';}
$('loanFilter').onchange=drawLoans;
async function loadDashboard(){try{const inv=await api('/items/summary'),cards=[['จำนวนรายการ',inv.itemCount],['อุปกรณ์ทั้งหมด',inv.total],['พร้อมใช้งาน',inv.available],['กำลังถูกยืม',inv.borrowed],['เสีย/ชำรุด',inv.broken+inv.damaged],['สูญหาย',inv.lost]];let loanSummary={};if(user.role!=='student')loanSummary=await api('/loans/summary');else loans=await api('/loans');window.loanSummaryCache=loanSummary;$('dashStats').innerHTML=cards.map(c=>`<div class="sc"><b>${c[1]}</b><span>${c[0]}</span></div>`).join('')+(user.role!=='student'?`<div class="sc"><b>${loanSummary.pending||0}</b><span>รออนุมัติ</span></div><div class="sc"><b>${loanSummary.overdue||0}</b><span>เกินกำหนด</span></div>`:`<div class="sc"><b>${loans.filter(l=>l.overdue).length}</b><span>รายการเกินกำหนด</span></div>`);$('projectStats').innerHTML=user.role!=='student'&&loanSummary.projects?.length?`<h3>สถิติตามโปรเจกต์และกลุ่ม</h3><div class="projectGrid">${loanSummary.projects.map(p=>`<div class="projectCard"><b>${esc(p.project)}</b><span>${esc(p.group)}</span><span>${p.requests} คำขอ · ${p.items} ชิ้น · ใช้วัสดุ ${p.supplies||0} ชิ้น${p.overdue?` · เกินกำหนด ${p.overdue}`:''}</span></div>`).join('')}</div>`:'';const pending=(await api('/loans')).filter(l=>['pending','approved'].includes(l.status)&&(l.status==='pending'||l.overdue));$('dashLoans').innerHTML=pending.length?pending.slice(0,5).map(loanCard).join(''):'<div class="empty">ไม่มีรายการรอดำเนินการ</div>';}catch(e){$('dashStats').innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
$('dashLoans').onclick=async e=>handleLoanAction(e);
$('loanList').onclick=async e=>handleLoanAction(e);
async function handleLoanAction(e){const b=e.target.closest('[data-decision],[data-return]');if(!b)return;try{if(b.dataset.decision){const note=b.dataset.decision==='rejected'?prompt('เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)')||'':'';await api('/loans/'+b.dataset.id+'/decision','POST',{decision:b.dataset.decision,note})}else{const left=Number(b.dataset.left);returnTarget={loanId:b.dataset.return,itemId:b.dataset.item};$('returnItemName').textContent=b.dataset.name+' (ค้าง '+left+' ชิ้น)';$('returnQty').max=left;$('returnQty').value=left;$('returnNote').value='';$('returnError').textContent='';$('returnOverlay').classList.add('on');return}await loadLoans();await loadDashboard()}catch(err){alert(err.message)}}
$('saveReturn').onclick=async()=>{try{await api('/loans/'+returnTarget.loanId+'/return','POST',{itemId:returnTarget.itemId,quantity:Number($('returnQty').value),condition:$('returnCondition').value,note:$('returnNote').value});$('returnOverlay').classList.remove('on');await loadLoans();await load();await loadDashboard()}catch(e){$('returnError').textContent=e.message}};

function addLoanRow(){const row=document.createElement('div');row.className='loanRequestRow';row.innerHTML=`<select class="reqItem">${items.filter(i=>i.st.available>0).map(i=>`<option value="${i.id}">${esc(i.name)} (${esc(i.code)}) · เหลือ ${i.st.available}</option>`).join('')}</select><input class="reqQty" type="number" min="1" value="1"><button class="btn" type="button">ลบ</button>`;row.querySelector('button').onclick=()=>row.remove();$('loanRows').appendChild(row)}
$('newLoan').onclick=async()=>{await load();$('loanRows').innerHTML='';addLoanRow();const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);$('loanBorrowDate').value=today;$('loanDueDate').value=today;$('loanError').textContent='';$('loanOverlay').classList.add('on')};$('addLoanRow').onclick=addLoanRow;
$('submitLoan').onclick=async()=>{const selected=[...document.querySelectorAll('.loanRequestRow')].map(r=>({itemId:r.querySelector('.reqItem').value,quantity:Number(r.querySelector('.reqQty').value)}));try{await api('/loans','POST',{group:$('loanGroup').value,project:$('loanProject').value,purpose:$('loanPurpose').value,borrowDate:$('loanBorrowDate').value,dueDate:$('loanDueDate').value,items:selected});$('loanOverlay').classList.remove('on');await loadLoans();await loadDashboard()}catch(e){$('loanError').textContent=e.message}};

async function loadUsers(){if(user.role!=='admin')return;try{const [users,teachers]=await Promise.all([api('/auth/users'),api('/auth/teachers')]);$('userTeacher').innerHTML='<option value="">ยังไม่กำหนด</option>'+teachers.map(t=>`<option value="${t._id}">${esc(t.name)} (${esc(t.studentId)})</option>`).join('');$('userList').innerHTML='<h3>บัญชีผู้ใช้</h3>'+users.map(u=>`<div class="userRow"><b>${esc(u.name)}</b><span>${esc(u.studentId)} · ${esc(u.department)} · ${esc(u.phone)} · ${esc(u.email)}</span><span>${({admin:'Admin',teacher:'อาจารย์',student:'นักศึกษา'})[u.role]}</span></div>`).join('')}catch(e){$('userList').textContent=e.message}}
$('createUser').onclick=async()=>{try{await api('/auth/users','POST',{name:$('userName').value,studentId:$('userId').value,department:$('userDept').value,phone:$('userPhone').value,email:$('userEmail').value,password:$('userPassword').value,role:$('userRole').value,teacher:$('userTeacher').value});$('userError').textContent='สร้างบัญชีแล้ว';await loadUsers()}catch(e){$('userError').textContent=e.message}};


const loadDashboardBase=loadDashboard;
loadDashboard=async()=>{await loadDashboardBase();if(user?.role==='student'){$('monthStats').innerHTML='';return}try{const data=window.loanSummaryCache||{};$('monthStats').innerHTML=`<h3>สถิติการใช้งาน 6 เดือนล่าสุด</h3><div class="sum">${(data.monthly||[]).map(m=>`<div class="sc"><b>${m.quantity}</b><span>${esc(m.month)} · ${m.requests} คำขอ</span></div>`).join('')}</div>`}catch(e){$('monthStats').textContent=e.message}};
if(token){api('/auth/me').then(me=>{user=me;showApp()}).catch(()=>{token='';localStorage.removeItem('stockToken');showApp()})}else showApp();




