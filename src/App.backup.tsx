﻿import React, { useMemo, useState, useEffect, useRef } from 'react'
import { format, isAfter, isBefore, parseISO } from 'date-fns'
import { loadCheques, saveCheque, type Cheque, newId, type Payee, loadPayees, savePayee, deleteCheque, deletePayee, updateCheque } from './data.ts'

type Status = 'pending'|'paid'|'bounced'

export default function App(){
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [filter, setFilter] = useState<{status:'all'|Status; from?:string; to?:string; q?:string}>({status:'all'})
  const [form, setForm] = useState<Partial<Cheque>>({ dueDate: new Date().toISOString().slice(0,10) })
  const [payees, setPayees] = useState<Payee[]>([])
  const [payeeForm, setPayeeForm] = useState<Partial<Payee>>({})
  const [view, setView] = useState<'cheques'|'payees'>('cheques')
  const [editingPayeeId, setEditingPayeeId] = useState<string|null>(null)
  const [editingPayee, setEditingPayee] = useState<Partial<Payee>>({})
  const [bulkPayees, setBulkPayees] = useState<string>("")
  const [bulkInfo, setBulkInfo] = useState<string>("")
  const [importInfo, setImportInfo] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement|null>(null)
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [lastAddedChequeId, setLastAddedChequeId] = useState<string|null>(null)
  const [lastAddedPayeeId, setLastAddedPayeeId] = useState<string|null>(null)
  const [chequeSort, setChequeSort] = useState<{key:'chequeNo'|'payer'|'amount'|'dueDate'|'status', dir:'asc'|'desc'}>({key:'dueDate', dir:'asc'})
  const [payeeSort, setPayeeSort] = useState<{key:'companyName'|'agentName'|'mobile', dir:'asc'|'desc'}>({key:'companyName', dir:'asc'})

  function exportPayees(){
    const data = JSON.stringify(payees, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0,10)
    a.href = url
    a.download = `payees-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportClick(){
    fileInputRef.current?.click()
  }

  async function onPayeesFileSelected(e: React.ChangeEvent<HTMLInputElement>){
    try{
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const json = JSON.parse(text)
      if (!Array.isArray(json)) throw new Error('JSON must be an array')

      const normalize = (s: string) => (s||'').trim().toLowerCase().replace(/\s+/g,' ')
      const existing = new Set(payees.map(p => normalize(p.companyName)))
      let added = 0
      let skipped = 0

      for (const entry of json){
        let companyName = ''
        let agentName = ''
        let mobile = ''
        if (typeof entry === 'string'){
          // Support simple string line: "Company[TAB]Agent[TAB]Mobile" or multi-spaces
          let parts = entry.split('\t').map((s:string)=>s.trim()).filter(Boolean)
          if (parts.length <= 1){
            parts = entry.split(/\s{2,}/).map((s:string)=>s.trim()).filter(Boolean)
          }
          companyName = parts[0] || entry
          agentName = parts[1] || ''
          mobile = parts[2] || ''
        } else if (typeof entry === 'object' && entry){
          // Support various key names
          companyName = entry.companyName || entry.company || entry.name || ''
          agentName = entry.agentName || entry.agent || ''
          mobile = entry.mobile || entry.phone || ''
        }
        if (!companyName) { skipped++; continue }
        const key = normalize(companyName)
        if (existing.has(key)) { skipped++; continue }
        existing.add(key)
        await savePayee({ id: newId(), companyName, agentName, mobile })
        added++
      }
      setPayees(await loadPayees())
      setImportInfo(`Imported ${added} payee(s), skipped ${skipped}.`)
    } catch(err:any){
      setImportInfo(`Import failed: ${err?.message||String(err)}`)
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  // Load data on mount
  useEffect(() => {
    loadCheques().then(setCheques)
    loadPayees().then(setPayees)
  }, [])

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('light', theme==='light')
  }, [theme])

  // Next cheque number (auto-increment from 900)
  // Next cheque number (auto-increment from 914)
  const nextChequeNo = useMemo(() => {
    const maxNo = cheques.reduce((m, c) => {
      const n = typeof (c as any).chequeNo === 'number' ? (c as any).chequeNo : 913
      return n > m ? n : m
    }, 913)
    return Math.max(914, maxNo + 1)
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

  async function markPaid(id:string){
    await updateCheque(id, { status: 'paid' })
    setCheques(await loadCheques())
  }

  async function remove(id:string){
    await deleteCheque(id)
    setCheques(await loadCheques())
  }

  async function addPayee(e: React.FormEvent){
    e.preventDefault()
    const item: Payee = {
      id: newId(),
      companyName: (payeeForm.companyName||'').trim(),
      agentName: (payeeForm.agentName||'').trim(),
      mobile: (payeeForm.mobile||'').trim(),
    }
    await savePayee(item)
    setPayees(await loadPayees())
    setPayeeForm({})
    setLastAddedPayeeId(item.id)
    window.setTimeout(()=>setLastAddedPayeeId(null), 1800)
  }

  async function removePayee(id: string){
    await deletePayee(id)
    setPayees(await loadPayees())
  }

  function startEditPayee(p: Payee){
    setEditingPayeeId(p.id)
    setEditingPayee({ companyName: p.companyName, agentName: p.agentName, mobile: p.mobile })
  }

  async function savePayeeEdit(e: React.FormEvent){
    e.preventDefault()
    if (!editingPayeeId) return
    await savePayee({
      id: editingPayeeId,
      companyName: (editingPayee.companyName||'').trim(),
      agentName: (editingPayee.agentName||'').trim(),
      mobile: (editingPayee.mobile||'').trim(),
    })
    setPayees(await loadPayees())
    setEditingPayeeId(null)
    setEditingPayee({})
  }

  function cancelPayeeEdit(){
    setEditingPayeeId(null)
    setEditingPayee({})
  }

  async function bulkAddPayees(e: React.FormEvent){
    e.preventDefault()
    const lines = bulkPayees.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    const toAdd: Payee[] = []
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g,' ')
    const existing = new Set(payees.map(p => normalize(p.companyName)))
    let added = 0, skipped = 0
    for (const line of lines){
      // Prefer tab-separated; fallback to 2+ spaces; else company only
      let parts = line.split('\t').map(s=>s.trim()).filter(s=>s.length>0)
      if (parts.length <= 1){
        parts = line.split(/\s{2,}/).map(s=>s.trim()).filter(Boolean)
      }
      const companyName = parts[0] || line
      const agentName = parts[1] || ''
      const mobile = parts[2] || ''
      const key = normalize(companyName)
      if (existing.has(key)) { skipped++; continue }
      existing.add(key)
      toAdd.push({ id: newId(), companyName, agentName, mobile })
      added++
    }
    // Save sequentially to keep it simple
    for (const p of toAdd){
      await savePayee(p)
    }
    setPayees(await loadPayees())
    setBulkPayees("")
    setBulkInfo(`Added ${added} payee(s), skipped ${skipped} duplicate(s).`)
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
    <div className="container">
      <header className="header">
        <h1>Dashboard</h1>
        <nav className="menu">
          <button className={view==='cheques'? 'active':''} onClick={()=>setView('cheques')}>Cheque Due</button>
          <button className={view==='payees'? 'active':''} onClick={()=>setView('payees')}>Payee</button>
          <button onClick={()=>setTheme(t=> t==='dark' ? 'light':'dark')}
            title={theme==='dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label="Toggle theme" className="icon-btn">
            {theme==='dark' ? 'â˜€ï¸' : 'ðŸŒ™'}
          </button>
        </nav>
      </header>

      {view==='payees' && (
        <section className="card">
          <h3>Payees</h3>
          <form onSubmit={addPayee} className="grid">
            <input required placeholder="Company Name" value={payeeForm.companyName||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPayeeForm((f: Partial<Payee>)=>({...f,companyName:e.target.value}))} />
            <input required placeholder="Agent Name" value={payeeForm.agentName||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPayeeForm((f: Partial<Payee>)=>({...f,agentName:e.target.value}))} />
            <input required placeholder="Mobile" value={payeeForm.mobile||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPayeeForm((f: Partial<Payee>)=>({...f,mobile:e.target.value}))} />
            <button type="submit">Add Payee</button>
          </form>
          <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
            <button onClick={exportPayees}>Export JSON</button>
            <button type="button" onClick={onImportClick}>Import JSON</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={onPayeesFileSelected} style={{display:'none'}} />
            {importInfo && <span style={{alignSelf:'center', color:'#666'}}>{importInfo}</span>}
          </div>

          <details style={{marginTop:12}}>
            <summary>Bulk add (paste lines: Company[TAB]Agent[TAB]Mobile)</summary>
            <form onSubmit={bulkAddPayees}>
              <textarea value={bulkPayees} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>)=>setBulkPayees(e.target.value)}
                rows={8} style={{width:'100%',marginTop:8}} placeholder="Acme Corp[TAB]John Doe[TAB]09123456789" />
              <div style={{marginTop:8}}>
                <button type="submit">Add List</button>
              </div>
            </form>
            {bulkInfo && <div style={{marginTop:6,color:'#666'}}>{bulkInfo}</div>}
          </details>
          <div className="table-wrap" style={{marginTop:8}}>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(payeeSort,'companyName', setPayeeSort)}>
                    Company {payeeSort.key==='companyName' ? (payeeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(payeeSort,'agentName', setPayeeSort)}>
                    Agent {payeeSort.key==='agentName' ? (payeeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(payeeSort,'mobile', setPayeeSort)}>
                    Mobile {payeeSort.key==='mobile' ? (payeeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayees.map(p=> (
                editingPayeeId===p.id ? (
                  <tr key={p.id}>
                    <td>
                      <input value={editingPayee.companyName||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditingPayee(f=>({...f, companyName:e.target.value}))} />
                    </td>
                    <td>
                      <input value={editingPayee.agentName||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditingPayee(f=>({...f, agentName:e.target.value}))} />
                    </td>
                    <td>
                      <input value={editingPayee.mobile||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditingPayee(f=>({...f, mobile:e.target.value}))} />
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <form onSubmit={savePayeeEdit} style={{display:'inline'}}>
                        <button type="submit">Save</button>
                      </form>
                      <button onClick={cancelPayeeEdit} style={{marginLeft:6}}>Cancel</button>
                      <button className="danger" onClick={()=>removePayee(p.id)} style={{marginLeft:6}}>Remove</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={lastAddedPayeeId===p.id? 'flash':''}>
                    <td>{p.companyName}</td>
                    <td>{p.agentName}</td>
                    <td>{p.mobile}</td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <button onClick={()=>startEditPayee(p)}>Edit</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          </div>
          {payees.length===0 && <div style={{padding:8,color:'#666'}}>No payees yet. Add one above.</div>}
        </section>
      )}

      {view==='cheques' && (
        <>
        <section className="card">
          <h3>Add Cheque</h3>
          <form onSubmit={addCheque} className="grid">
            <select className="payee-select" required value={(form as any).payeeId||''} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm((f: Partial<Cheque>)=>({...f, payeeId: e.target.value as any}))}>
              <option value="">Select Payee</option>
              {payees.map(p => (
                <option key={p.id} value={p.id}>{p.companyName} â€” {p.agentName}</option>
              ))}
            </select>
            <input required type="number" step="0.01" placeholder="Amount" value={form.amount||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f,amount:e.target.valueAsNumber}))} />
            <input required type="date" value={form.dueDate||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f,dueDate:e.target.value}))} />
            <input required type="number" step="1" min="1" placeholder="Cheque #" value={(form as any).chequeNo ?? nextChequeNo} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f, chequeNo: e.target.valueAsNumber}))} />
            <input placeholder="Notes" value={form.notes||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: Partial<Cheque>)=>({...f,notes:e.target.value}))} />
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="card">
          <h3>Filters</h3>
          <div className="grid">
            <select value={filter.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setFilter((f: any)=>({...f,status:e.target.value as any}))}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="bounced">Bounced</option>
            </select>
            <label>From <input type="date" value={filter.from||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,from:e.target.value||undefined}))} /></label>
            <label>To <input type="date" value={filter.to||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,to:e.target.value||undefined}))} /></label>
            <input placeholder="Search payer/notes" value={filter.q||''} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setFilter((f: any)=>({...f,q:e.target.value||undefined}))} />
          </div>
        </section>

        <section className="card">
          <h3>Cheques ({filtered.length})</h3>
          <div className="table-wrap">
          <table className="table">
          <thead>
            <tr>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'chequeNo', setChequeSort)}>
                    Cheque # {chequeSort.key==='chequeNo' ? (chequeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'payer', setChequeSort)}>
                    Payer {chequeSort.key==='payer' ? (chequeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'amount', setChequeSort)}>
                    Amount {chequeSort.key==='amount' ? (chequeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'dueDate', setChequeSort)}>
                    Due {chequeSort.key==='dueDate' ? (chequeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-btn" onClick={()=>toggleSort(chequeSort,'status', setChequeSort)}>
                    Status {chequeSort.key==='status' ? (chequeSort.dir==='asc'?'â–²':'â–¼') : ''}
                  </button>
                </th>
                <th>Company</th><th>Agent</th><th>Mobile</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sortedCheques.map((c: Cheque)=>{
              const overdue = c.status!=='paid' && isBefore(parseISO(c.dueDate), new Date())
              return (
                <tr key={c.id} className={`${overdue? 'overdue':''} ${lastAddedChequeId===c.id? 'flash':''}`}>
                  <td className="mono">{(c as any).chequeNo}</td>
                  <td>{c.payer}</td>
                  <td>{c.amount.toFixed(2)}</td>
                  <td>{format(parseISO(c.dueDate), 'yyyy-MM-dd')}</td>
                  <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  <td>{c.companyName}</td>
                  <td>{c.agent}</td>
                  <td>{c.mobile}</td>
                  <td>{c.notes}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {c.status!=='paid' && <button onClick={()=>markPaid(c.id)}>Mark paid</button>} {' '}
                    <button className="danger" onClick={()=>remove(c.id)}>Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
          </div>
          {filtered.length===0 && <div style={{padding:8,color:'#666'}}>No cheques match the filter.</div>}
        </section>
        </>
      )}
    </div>
  )
}
