import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, Employee, DebtEntry } from '../data';
import { loadDebtEntries, saveDebtEntry, deleteDebtEntry, newId } from '../data';
import { parseISO, format } from 'date-fns';

type DebtTrackerProps = {
  customers: Customer[];
  employees: Employee[];
};

export default function DebtTracker({ customers, employees }: DebtTrackerProps) {
  const [activeTab, setActiveTab] = useState<'customers' | 'employees'>('customers');
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [form, setForm] = useState<Partial<DebtEntry>>({ type: 'charge', date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    loadDebtEntries().then(setEntries);
  }, []);

  async function refreshEntries() {
    setEntries(await loadDebtEntries());
  }

  const currentList = activeTab === 'customers' ? customers : employees;
  const sortedList = useMemo(() => [...currentList].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [currentList]);

  const filteredEntries = useMemo(() => {
    const entityType = activeTab === 'customers' ? 'customer' : 'employee';
    return entries.filter(e => e.entityType === entityType).sort((a, b) => {
      const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id.localeCompare(a.id);
    });
  }, [entries, activeTab]);

  const balances = useMemo(() => {
    const entityType = activeTab === 'customers' ? 'customer' : 'employee';
    const list = entityType === 'customer' ? customers : employees;
    const balanceMap = new Map<string, { entity: Customer | Employee; balance: number; entries: DebtEntry[] }>();

    list.forEach(entity => {
      balanceMap.set(entity.id, { entity, balance: 0, entries: [] });
    });

    filteredEntries.forEach(entry => {
      const item = balanceMap.get(entry.entityId);
      if (item) {
        item.entries.push(entry);
        if (entry.type === 'charge') {
          item.balance += entry.amount;
        } else {
          item.balance -= entry.amount;
        }
      }
    });

    return Array.from(balanceMap.values()).filter(item => item.entries.length > 0);
  }, [filteredEntries, activeTab, customers, employees]);

  const activeDebts = useMemo(() => balances.filter(b => b.balance !== 0).sort((a, b) => (a.entity.name || '').localeCompare(b.entity.name || '')), [balances]);
  const clearedDebts = useMemo(() => balances.filter(b => b.balance === 0).sort((a, b) => (a.entity.name || '').localeCompare(b.entity.name || '')), [balances]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.entityId || !form.amount || !form.date || !form.type) return;

    const entityType = activeTab === 'customers' ? 'customer' : 'employee';
    const entity = (entityType === 'customer' ? customers : employees).find(p => p.id === form.entityId);
    if (!entity) return;

    const newEntry: DebtEntry = {
      id: newId(),
      entityType,
      entityId: form.entityId,
      entityName: entity.name,
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      description: (form.description || '').trim(),
    };

    await saveDebtEntry(newEntry);
    await refreshEntries();
    setForm({ type: 'charge', date: new Date().toISOString().slice(0, 10) });
  }

  async function handleDeleteEntry(id: string) {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await deleteDebtEntry(id);
      await refreshEntries();
    }
  }

  const summary = useMemo(() => {
    let totalCharges = 0;
    let totalPayments = 0;
    filteredEntries.forEach(e => {
      if (e.type === 'charge') totalCharges += e.amount;
      else totalPayments += e.amount;
    });
    return { totalCharges, totalPayments, netBalance: totalCharges - totalPayments };
  }, [filteredEntries]);

  const entityLabel = activeTab === 'customers' ? 'Customer' : 'Employee';

  return (
    <div>
      <h2>Debt Tracker</h2>
      <div className="tab-nav">
        <button className={`tab-button ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Customer Debt</button>
        <button className={`tab-button ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>Employee Debt</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ background: 'rgba(255, 100, 100, 0.1)', borderColor: 'rgba(255, 100, 100, 0.3)' }}>
          <div style={{ fontSize: '0.9em', color: '#999' }}>Total Charges</div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#ff6464' }}>{summary.totalCharges.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card" style={{ background: 'rgba(100, 255, 100, 0.1)', borderColor: 'rgba(100, 255, 100, 0.3)' }}>
          <div style={{ fontSize: '0.9em', color: '#999' }}>Total Payments</div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#64ff64' }}>{summary.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card" style={{ background: 'rgba(110, 231, 240, 0.1)', borderColor: 'rgba(110, 231, 240, 0.3)' }}>
          <div style={{ fontSize: '0.9em', color: '#999' }}>Net Balance</div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: summary.netBalance >= 0 ? '#ff6464' : '#64ff64' }}>{summary.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <section className="card">
        <h3>Add {entityLabel} Debt Entry</h3>
        <form onSubmit={handleAddEntry} className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea' }}>
          <select required value={form.entityId || ''} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))}>
            <option value="">Select {entityLabel}</option>
            {sortedList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select required value={form.type || 'charge'} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'charge' | 'payment' }))}>
            <option value="charge">Charge (Debt +)</option>
            <option value="payment">Payment (Debt -)</option>
          </select>
          <input required type="number" step="0.01" min="0" placeholder="Amount" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.valueAsNumber }))} />
          <input required type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input placeholder="Description (optional)" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ gridColumn: 'span 2' }} />
          <button type="submit">Add Entry</button>
        </form>
      </section>

      <section className="card">
        <h3>{entityLabel} Balances & History</h3>
        {activeDebts.length > 0 && <div style={{ marginBottom: 24 }}>
          <h4 style={{ color: '#ff6464', marginBottom: 12 }}>Active Debts ({activeDebts.length})</h4>
          {activeDebts.map(({ entity, balance, entries: entityEntries }) => (
            <details key={entity.id} style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '8px 0' }}>{entity.name} — Balance: <span style={{ color: balance >= 0 ? '#ff6464' : '#64ff64' }}>{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> ({entityEntries.length} entries)</summary>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th><th>Running Balance</th><th>Actions</th></tr></thead>
                  <tbody>{entityEntries.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime() || a.id.localeCompare(b.id)).reduce((acc, entry) => { const prevBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0; const runningBalance = entry.type === 'charge' ? prevBalance + entry.amount : prevBalance - entry.amount; acc.push({ entry, runningBalance }); return acc; }, [] as { entry: DebtEntry, runningBalance: number }[]).map(({ entry, runningBalance }) => <tr key={entry.id}><td>{format(parseISO(entry.date), 'yyyy-MM-dd')}</td><td><span className="badge" style={{ background: entry.type === 'charge' ? 'rgba(255, 100, 100, 0.2)' : 'rgba(100, 255, 100, 0.2)', color: entry.type === 'charge' ? '#ff6464' : '#64ff64' }}>{entry.type}</span></td><td>{entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td>{entry.description || '—'}</td><td style={{ fontWeight: 'bold', color: runningBalance >= 0 ? '#ff6464' : '#64ff64' }}>{runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td><button className="danger" onClick={() => handleDeleteEntry(entry.id)}>Delete</button></td></tr>)}</tbody>
                </table>
              </div>
            </details>
          ))}
        </div>}
        {clearedDebts.length > 0 && <div>
          <h4 style={{ color: '#64ff64', marginBottom: 12 }}>Cleared/Zero Balance ({clearedDebts.length})</h4>
          {clearedDebts.map(({ entity, balance, entries: entityEntries }) => (
            <details key={entity.id} style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '8px 0' }}>{entity.name} — Balance: <span style={{ color: '#64ff64' }}>{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> ({entityEntries.length} entries)</summary>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th><th>Running Balance</th><th>Actions</th></tr></thead>
                  <tbody>{entityEntries.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime() || a.id.localeCompare(b.id)).reduce((acc, entry) => { const prevBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0; const runningBalance = entry.type === 'charge' ? prevBalance + entry.amount : prevBalance - entry.amount; acc.push({ entry, runningBalance }); return acc; }, [] as { entry: DebtEntry, runningBalance: number }[]).map(({ entry, runningBalance }) => <tr key={entry.id}><td>{format(parseISO(entry.date), 'yyyy-MM-dd')}</td><td><span className="badge" style={{ background: entry.type === 'charge' ? 'rgba(255, 100, 100, 0.2)' : 'rgba(100, 255, 100, 0.2)', color: entry.type === 'charge' ? '#ff6464' : '#64ff64' }}>{entry.type}</span></td><td>{entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td>{entry.description || '—'}</td><td style={{ fontWeight: 'bold', color: runningBalance >= 0 ? '#ff6464' : '#64ff64' }}>{runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td><button className="danger" onClick={() => handleDeleteEntry(entry.id)}>Delete</button></td></tr>)}</tbody>
                </table>
              </div>
            </details>
          ))}
        </div>}
        {activeDebts.length === 0 && clearedDebts.length === 0 && <div style={{ padding: 8, color: '#666' }}>No debt entries yet.</div>}
      </section>
    </div>
  );
}