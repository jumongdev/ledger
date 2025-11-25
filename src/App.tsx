import React, { useMemo, useState, useEffect, useRef } from 'react'
import { format, isAfter, isBefore, parseISO } from 'date-fns'
import { loadCheques, saveCheque, type Cheque, newId, type Payee, loadPayees, savePayee, deleteCheque, deletePayee, updateCheque, type Status, loadCustomers, loadEmployees, replaceAllEmployees, toggleEmployeeActive, loadStores, replaceAllStores, exportAllData, importAllData } from './data'
import Management from './pages/Management'
import StoreSales from './pages/StoreSales'
import Payroll from './pages/Payroll'
import DebtTracker from './pages/DebtTracker'

function Settings({ handleExportAll, handleImportAll, fileInputRef, backupInfo }: any) {
  return (
    <section className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h2>Settings</h2>
      <button onClick={handleExportAll} style={{width:'100%', marginBottom:12, background:'#333', color:'#fff', border:'none', borderRadius:4, padding:'12px 0', cursor:'pointer'}}>Export All Data</button>
      <button onClick={()=>fileInputRef.current?.click()} style={{width:'100%', background:'#333', color:'#fff', border:'none', borderRadius:4, padding:'12px 0', cursor:'pointer'}}>Import All Data</button>
      <input type="file" accept="application/json" style={{display:'none'}} ref={fileInputRef} onChange={handleImportAll} />
      {backupInfo && <div style={{color:'#888', fontSize:14, marginTop:8}}>{backupInfo}</div>}
    </section>
  );
}
export default function App() {
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  const [backupInfo, setBackupInfo] = useState<string | null>(null);
    // Export all data as JSON
    const handleExportAll = async () => {
      try {
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cheque-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        setBackupInfo('Exported successfully.');
      } catch (err) {
        setBackupInfo('Export failed.');
      }
    };

    // Import all data from JSON
    const handleImportAll = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllData(data);
        setCheques(await loadCheques());
        setPayees(await loadPayees());
        setEmployees(await loadEmployees());
        setCustomers(await loadCustomers());
        setStores(await loadStores());
        setBackupInfo('Imported successfully.');
      } catch (err) {
        setBackupInfo('Import failed.');
      }
    };
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [filter, setFilter] = useState<{status:'all'|Status; from?:string; to?:string; q?:string}>({status:'all'})
  const [form, setForm] = useState<Partial<Cheque>>({ dueDate: new Date().toISOString().slice(0,10) })
  const [payees, setPayees] = useState<Payee[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [view, setView] = useState<'cheques' | 'management' | 'storesales' | 'payroll' | 'debts' | 'settings'>('cheques')
  const [editingChequeId, setEditingChequeId] = useState<string | null>(null)
  const [editingCheque, setEditingCheque] = useState<Partial<Cheque>>({ status: 'pending', dueDate: '' })
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [lastAddedChequeId, setLastAddedChequeId] = useState<string|null>(null)
  const [lastAddedPayeeId, setLastAddedPayeeId] = useState<string|null>(null)
  const [chequeSort, setChequeSort] = useState<{key:'chequeNo'|'payer'|'amount'|'dueDate'|'status', dir:'asc'|'desc'}>({key:'dueDate', dir:'asc'})
  const [payeeSort, setPayeeSort] = useState<{key:'companyName'|'agentName'|'mobile', dir:'asc'|'desc'}>({key:'companyName', dir:'asc'})

  // Load data on mount
  useEffect(() => {
    loadCheques().then(setCheques)
    loadPayees().then(setPayees)
    loadCustomers().then(setCustomers)
  }, [])

  useEffect(() => {
    loadEmployees().then(setEmployees)
    loadStores().then(setStores)
  }, [])

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('light', theme==='light')
  }, [theme])

  // Next cheque number (auto-increment from 1351)
  const nextChequeNo = useMemo(() => {
    const maxNo = cheques.reduce((m, c) => {
      const n = typeof (c as any).chequeNo === 'number' ? (c as any).chequeNo : 1350
      return n > m ? n : m
    }, 1350)
    return Math.max(1351, maxNo + 1)
  }, [cheques])

  async function addCheque(e: React.FormEvent){
    e.preventDefault()
    const p = payees.find(x => x.id === (form as any).payeeId)
    if (!p) return
    const inputChequeNo = (form as any).chequeNo
    const chequeNo = typeof inputChequeNo === 'number' && !Number.isNaN(inputChequeNo)
      ? Math.max(1, Math.floor(inputChequeNo))
      : nextChequeNo
    const item: Cheque = {
      id: newId(),
      payer: p.companyName,
      amount: Number(form.amount||0),
      dueDate: form.dueDate!,
      status: 'pending',
      notes: form.notes||'',
      companyName: p.companyName,
      agent: p.agentName,
      mobile: p.mobile,
      chequeNo,
      payeeId: p.id
    }
    await saveCheque(item)
    setCheques(await loadCheques())
    setForm({ dueDate: new Date().toISOString().slice(0,10) })
    setLastAddedChequeId(item.id)
    window.setTimeout(()=>setLastAddedChequeId(null), 1800)
  }

  function startEditCheque(cheque: Cheque) {
    setEditingChequeId(cheque.id)
    setEditingCheque({ status: cheque.status, dueDate: cheque.dueDate })
  }

  async function saveChequeEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingChequeId) return
    await updateCheque(editingChequeId, { status: editingCheque.status, dueDate: editingCheque.dueDate })
    setCheques(await loadCheques())
    setEditingChequeId(null)
    setEditingCheque({ status: 'pending', dueDate: '' })
  }

  function cancelChequeEdit() {
    setEditingChequeId(null)
    setEditingCheque({ status: 'pending', dueDate: '' })
  }

  const filtered = useMemo(()=>{
    return cheques.filter((c: Cheque)=>{
      if (filter.status!=='all' && c.status!==filter.status) return false
      if (filter.from && isBefore(parseISO(c.dueDate), parseISO(filter.from))) return false
      if (filter.to && isAfter(parseISO(c.dueDate), parseISO(filter.to))) return false
      if (filter.q){
        const q = filter.q.toLowerCase()
        if (!(c.payer.toLowerCase().includes(q) || (c.notes||'').toLowerCase().includes(q))) return false
      }
      return true
    })
  },[cheques, filter])

  const sortedCheques = useMemo(() => {
    const arr = [...filtered]
    const dir = chequeSort.dir === 'asc' ? 1 : -1
    arr.sort((a,b) => {
      const k = chequeSort.key
      if (k==='amount') return (a.amount - b.amount) * dir
      if (k==='chequeNo') return ((a as any).chequeNo||0 - (b as any).chequeNo||0) * dir
      if (k==='dueDate') return (parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime()) * dir
      const av = (k==='payer' ? a.payer : a.status)
      const bv = (k==='payer' ? b.payer : b.status)
      return av.localeCompare(bv) * dir
    })
    return arr
  }, [filtered, chequeSort])

  const sortedPayees = useMemo(() => {
    const arr = [...payees]
    const dir = payeeSort.dir === 'asc' ? 1 : -1
    arr.sort((a,b) => {
      const k = payeeSort.key
      const av = k==='companyName' ? a.companyName : (k==='agentName' ? a.agentName : a.mobile)
      const bv = k==='companyName' ? b.companyName : (k==='agentName' ? b.agentName : b.mobile)
      return (av||'').localeCompare(bv||'') * dir
    })
    return arr
  }, [payees, payeeSort])

  function toggleSort(current: {key:string, dir:'asc'|'desc'}, key: string, set: (v:any)=>void){
    if (current.key === key) set({key, dir: current.dir==='asc' ? 'desc' : 'asc'})
    else set({key, dir:'asc'})
  }

  return (
    <div style={{display:'flex', minHeight:'100vh', background:'#f7f7fa'}}>
      {/* Sidebar */}
      <aside style={{width:220, background:'#f4f6fa', color:'#222', display:'flex', flexDirection:'column', alignItems:'stretch', minHeight:'100vh', boxShadow:'2px 0 8px rgba(0,0,0,0.04)'}}>
        <div style={{padding:'32px 16px 24px 16px', borderBottom:'1px solid #e0e3ea', marginBottom:16}}>
          <h2 style={{margin:0, fontSize:22, fontWeight:700, letterSpacing:1, color:'#2a3a4a'}}>Dashboard</h2>
        </div>
        <nav style={{display:'flex', flexDirection:'column', gap:4, padding:'0 16px'}}>
          <button className={view==='cheques'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='cheques'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, marginBottom:2, cursor:'pointer', fontWeight:view==='cheques'?'bold':'normal'}} onClick={()=>setView('cheques')}>Cheque Due</button>
          <button className={view==='management'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='management'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, marginBottom:2, cursor:'pointer', fontWeight:view==='management'?'bold':'normal'}} onClick={()=>setView('management')}>Management</button>
          <button className={view==='storesales'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='storesales'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, marginBottom:2, cursor:'pointer', fontWeight:view==='storesales'?'bold':'normal'}} onClick={()=>setView('storesales')}>Store Sales</button>
          <button className={view==='payroll'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='payroll'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, marginBottom:2, cursor:'pointer', fontWeight:view==='payroll'?'bold':'normal'}} onClick={()=>setView('payroll')}>Payroll</button>
          <button className={view==='debts'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='debts'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, marginBottom:2, cursor:'pointer', fontWeight:view==='debts'?'bold':'normal'}} onClick={()=>setView('debts')}>Debt Tracker</button>
          <button className={view==='settings'? 'active':''} style={{textAlign:'left', padding:'12px 14px', background:view==='settings'?'#e0e7ef':'none', color:'#222', border:'none', borderRadius:4, margin:'24px 0 0 0', cursor:'pointer', fontWeight:view==='settings'?'bold':'normal'}} onClick={()=>setView('settings')}>Settings</button>
          <button onClick={()=>setTheme(t=> t==='dark' ? 'light':'dark')}
            title={theme==='dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label="Toggle theme" className="icon-btn"
            style={{marginTop:16, background:'#e0e7ef', color:'#2a3a4a', border:'1px solid #b0b8c9', borderRadius:4, padding:'8px 12px', cursor:'pointer', fontWeight:'bold'}}>
            {theme==='dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </nav>
      </aside>
      {/* Main Content */}
      <main style={{flex:1, padding:'40px 32px', minHeight:'100vh', background:'#fff', color:'#222', boxShadow:'0 0 0 1px #e0e3ea inset'}}>

      {view === 'storesales' && <StoreSales stores={stores} employees={employees} />}
      {view === 'debts' && <DebtTracker customers={customers} employees={employees} />}
      {view === 'payroll' && <Payroll employees={employees} />}
      {view === 'management' && (
        <Management
          customers={customers}
          onCustomersChange={async () => setCustomers(await loadCustomers())}
          payees={payees}
          onPayeesChange={async () => setPayees(await loadPayees())}
          lastAddedPayeeId={lastAddedPayeeId}
          payeeSort={payeeSort}
          onTogglePayeeSort={(key) => toggleSort(payeeSort, key, setPayeeSort)}
          sortedPayees={sortedPayees}
          employees={employees}
          onEmployeesChange={async (updated) => {
            await replaceAllEmployees(updated)
            setEmployees(await loadEmployees())
          }}
          onToggleEmployeeActive={async (id) => {
            await toggleEmployeeActive(id)
            setEmployees(await loadEmployees())
          }}
          stores={stores}
          onStoresChange={async (updated) => {
            await replaceAllStores(updated)
            setStores(await loadStores())
          }}
        />
      )}
      {view === 'settings' && (
        <Settings handleExportAll={handleExportAll} handleImportAll={handleImportAll} fileInputRef={fileInputRef} backupInfo={backupInfo} />
      )}

      {view==='cheques' && (
        <>
        <section className="card">
          <h3>Add Cheque</h3>
          <form onSubmit={addCheque} className="grid">
            <select className="filter-select payee-select" required value={(form as any).payeeId||''} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm((f: Partial<Cheque>)=>({...f, payeeId: e.target.value as any}))}
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
              <option value="">Select Payee</option>
              {payees.map(p => (
                <option key={p.id} value={p.id}>{p.companyName} — {p.agentName}</option>
              ))}
            </select>
            <input required type="number" step="0.01" placeholder="Amount" value={form.amount||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f,amount:e.target.valueAsNumber}))}
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
            <input required type="date" value={form.dueDate||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f,dueDate:e.target.value}))}
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
            <input required type="number" step="1" min="1" placeholder="Cheque #" value={(form as any).chequeNo ?? nextChequeNo} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f, chequeNo: e.target.valueAsNumber}))}
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
            <button type="submit" style={{fontSize:'1.1em', padding:'10px 0', borderRadius:5, background:'#2a3a4a', color:'#fff', border:'none', fontWeight:'bold', marginTop:2}}>Add</button>
          </form>
        </section>

        <section className="card">
          <h3>Filters</h3>
          <div className="grid">
            <select className="filter-select" value={filter.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setFilter((f: any)=>({...f,status:e.target.value as any}))}
              style={{fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="bounced">Bounced</option>
              <option value="cancel">Cancel</option>
              <option value="replacement">Replacement</option>
            </select>
            <label style={{fontSize:'1.05em', color:'#2a3a4a'}}>From <input type="date" value={filter.from||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,from:e.target.value||undefined}))}
              style={{fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginLeft:4, marginBottom: 4}} /></label>
            <label style={{fontSize:'1.05em', color:'#2a3a4a'}}>To <input type="date" value={filter.to||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,to:e.target.value||undefined}))}
              style={{fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginLeft:4, marginBottom: 4}} /></label>
            <input placeholder="Search payer/company" value={filter.q||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,q:e.target.value||undefined}))}
              style={{fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
          </div>
        </section>

        {/* Pending Cheques Table */}
        <section className="card">
          <h3>Pending Cheques</h3>
          <div style={{marginBottom: 8, fontWeight: 'bold'}}>
            Total Pending (in date range): {
              sortedCheques.filter(c => c.status === 'pending' &&
                (!filter.from || !c.dueDate || !isBefore(parseISO(c.dueDate), parseISO(filter.from))) &&
                (!filter.to || !c.dueDate || !isAfter(parseISO(c.dueDate), parseISO(filter.to)))
              ).reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
            }
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'chequeNo', setChequeSort)}>
                      Cheque # {chequeSort.key==='chequeNo' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'amount', setChequeSort)}>
                      Amount {chequeSort.key==='amount' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'dueDate', setChequeSort)}>
                      Due {chequeSort.key==='dueDate' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'status', setChequeSort)}>
                      Status {chequeSort.key==='status' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedCheques.filter(c => c.status === 'pending').map((c: Cheque) => {
                  const overdue = c.status !== 'paid' && isBefore(parseISO(c.dueDate), new Date())
                  return (
                    <tr key={c.id} className={`${overdue ? 'overdue' : ''} ${lastAddedChequeId === c.id ? 'flash' : ''}`}>
                      <td className="mono">{(c as any).chequeNo}</td>
                      <td>{format(parseISO(c.dueDate), 'yyyy-MM-dd')}</td>
                      <td>{c.companyName}</td>
                      <td>{c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {editingChequeId === c.id ? (
                          <form onSubmit={saveChequeEdit} style={{ display: 'inline' }}>
                            <select className="edit-select" value={editingCheque.status} onChange={e => setEditingCheque({ ...editingCheque, status: e.target.value as Status })}>
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="bounced">Bounced</option>
                              <option value="cancel">Cancel</option>
                              <option value="replacement">Replacement</option>
                            </select> {' '}
                            <input type="date" value={editingCheque.dueDate} onChange={e => setEditingCheque({ ...editingCheque, dueDate: e.target.value })} /> {' '}
                            <button type="submit">Save</button> {' '}
                            <button type="button" onClick={cancelChequeEdit}>Cancel</button>
                          </form>
                        ) : <button onClick={() => startEditCheque(c)}>Edit</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sortedCheques.filter(c => c.status === 'pending').length === 0 && <div style={{ padding: 8, color: '#666' }}>No pending cheques match the filter.</div>}
        </section>

        {/* Paid and Cancelled Cheques Table */}
        <section className="card">
          <h3>Paid & Cancelled Cheques</h3>
          <div style={{marginBottom: 8, fontWeight: 'bold'}}>
            Total Cancelled (in date range): {
              sortedCheques.filter(c => c.status === 'cancel' &&
                (!filter.from || !c.dueDate || !isBefore(parseISO(c.dueDate), parseISO(filter.from))) &&
                (!filter.to || !c.dueDate || !isAfter(parseISO(c.dueDate), parseISO(filter.to)))
              ).reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
            }
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'chequeNo', setChequeSort)}>
                      Cheque # {chequeSort.key==='chequeNo' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'amount', setChequeSort)}>
                      Amount {chequeSort.key==='amount' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'dueDate', setChequeSort)}>
                      Due {chequeSort.key==='dueDate' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'status', setChequeSort)}>
                      Status {chequeSort.key==='status' ? (chequeSort.dir==='asc'?'▲':'▼') : ''}
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedCheques.filter(c => c.status === 'paid' || c.status === 'cancel').map((c: Cheque) => {
                  return (
                    <tr key={c.id} className={`${lastAddedChequeId === c.id ? 'flash' : ''}`}>
                      <td className="mono">{(c as any).chequeNo}</td>
                      <td>{format(parseISO(c.dueDate), 'yyyy-MM-dd')}</td>
                      <td>{c.companyName}</td>
                      <td>{c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {editingChequeId === c.id ? (
                          <form onSubmit={saveChequeEdit} style={{ display: 'inline' }}>
                            <select className="edit-select" value={editingCheque.status} onChange={e => setEditingCheque({ ...editingCheque, status: e.target.value as Status })}>
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="bounced">Bounced</option>
                              <option value="cancel">Cancel</option>
                              <option value="replacement">Replacement</option>
                            </select> {' '}
                            <input type="date" value={editingCheque.dueDate} onChange={e => setEditingCheque({ ...editingCheque, dueDate: e.target.value })} /> {' '}
                            <button type="submit">Save</button> {' '}
                            <button type="button" onClick={cancelChequeEdit}>Cancel</button>
                          </form>
                        ) : <button onClick={() => startEditCheque(c)}>Edit</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sortedCheques.filter(c => c.status === 'paid' || c.status === 'cancel').length === 0 && <div style={{ padding: 8, color: '#666' }}>No paid or cancelled cheques match the filter.</div>}
        </section>
        </>
      )}
      </main>
    </div>
  )
}
