import React, { useState, useEffect, useMemo } from 'react';
import type { Store, Employee, StoreSale } from '../data';
import { loadStoreSales, saveStoreSale, updateStoreSale, deleteStoreSale, newId } from '../data';

type StoreSalesProps = {
  stores: Store[];
  employees: Employee[];
};

export default function StoreSales({ stores, employees }: StoreSalesProps) {
  const [sales, setSales] = useState<StoreSale[]>([]);
  const [form, setForm] = useState<Partial<StoreSale>>({});
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<StoreSale>>({ sales: 0, remit: 0 });
  const [filter, setFilter] = useState<{ storeId: 'all' | string }>({ storeId: 'all' });

  useEffect(() => {
    loadStoreSales().then(setSales);
  }, []);

  const cashiers = employees.filter(
    emp => emp.position === 'Cashier' && (form.storeId ? emp.storeId === form.storeId : true)
  );

  const sortedCashiers = useMemo(() => {
    return [...cashiers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [cashiers]);

  const handleStoreChange = (storeId: string) => {
    setForm(prev => {
      const newForm = { ...prev, storeId };
      if (prev.cashierId) {
        const cashier = employees.find(e => e.id === prev.cashierId);
        if (cashier && cashier.storeId !== storeId) {
          newForm.cashierId = undefined;
        }
      }
      return newForm;
    });
  };

  const filteredSales = useMemo(() => {
    const list = sales.filter(s => filter.storeId === 'all' || s.storeId === filter.storeId);
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [sales, filter]);

  const allStoresTotal = useMemo(() => {
    const salesSum = sales.reduce((sum, s) => sum + (s.sales || 0), 0);
    const remitSum = sales.reduce((sum, s) => sum + (s.remit || 0), 0);
    const diff = remitSum - salesSum;
    return { salesSum, remitSum, diff };
  }, [sales]);

  const filteredTotal = useMemo(() => {
    const salesSum = filteredSales.reduce((sum, s) => sum + (s.sales || 0), 0);
    const remitSum = filteredSales.reduce((sum, s) => sum + (s.remit || 0), 0);
    const diff = remitSum - salesSum;
    return { salesSum, remitSum, diff };
  }, [filteredSales]);

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    if (!form.storeId || !form.cashierId || form.sales == null || form.remit == null || !form.date) return;

    const store = stores.find(s => s.id === form.storeId);
    const cashier = employees.find(emp => emp.id === form.cashierId);
    if (!store || !cashier) return;

    const newSale: StoreSale = {
      id: newId(),
      storeId: store.id,
      storeName: store.storeName,
      cashierId: cashier.id,
      cashierName: cashier.name,
      sales: Number(form.sales),
      remit: Number(form.remit),
      date: form.date,
    };

    await saveStoreSale(newSale);
    setSales(await loadStoreSales());
    setForm({});
  }

  function startEdit(sale: StoreSale) {
    setEditingSaleId(sale.id);
    setEditingForm({ sales: sale.sales, remit: sale.remit });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingSaleId) {
      await updateStoreSale(editingSaleId, { sales: editingForm.sales, remit: editingForm.remit });
      setSales(await loadStoreSales());
      setEditingSaleId(null);
      setEditingForm({ sales: 0, remit: 0 });
    }
  }

  function cancelEdit() {
    setEditingSaleId(null);
    setEditingForm({ sales: 0, remit: 0 });
  }

  async function handleDelete(id: string) {
    if (window.confirm('Are you sure you want to delete this sale record?')) {
      await deleteStoreSale(id);
      setSales(await loadStoreSales());
    }
  }

  return (
    <div>
      <section className="card">
        <h3>Store Sales</h3>
        <form onSubmit={handleAddSale} className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea' }}>
          <input required type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
          <select required value={form.storeId || ''} onChange={e => handleStoreChange(e.target.value)}
            style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
            <option value="">Select Store</option>
            {stores.map(store => <option key={store.id} value={store.id}>{store.storeName}</option>)}
          </select>
          <select required value={form.cashierId || ''} onChange={e => setForm(f => ({ ...f, cashierId: e.target.value }))} disabled={!form.storeId} title={!form.storeId ? 'Please select a store first' : ''}
            style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
            <option value="">{form.storeId ? 'Select Cashier' : 'Select store first'}</option>
            {sortedCashiers.map(c => {
              const store = stores.find(s => s.id === c.storeId);
              return <option key={c.id} value={c.id}>{c.name} {store ? `(${store.storeName})` : ''}</option>;
            })}
          </select>
          <input required type="number" step="0.01" placeholder="Sales" value={form.sales ?? ''} onChange={e => setForm(f => ({ ...f, sales: e.target.valueAsNumber }))}
            style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
          <input required type="number" step="0.01" placeholder="Remit" value={form.remit ?? ''} onChange={e => setForm(f => ({ ...f, remit: e.target.valueAsNumber }))}
            style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}} />
          <button type="submit">Add</button>
        </form>
        {sortedCashiers.length === 0 && form.storeId && <div style={{ marginTop: 8, padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, color: '#ef4444' }}>⚠️ No cashiers assigned to this store. Please add cashiers for this store in the Management tab.</div>}
        {!form.storeId && employees.filter(e => e.position === 'Cashier').length === 0 && <div style={{ marginTop: 8, padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, color: '#ef4444' }}>⚠️ No cashiers found. Please add employees with "Cashier" position in the Management tab first.</div>}
        {stores.length === 0 && <div style={{ marginTop: 8, padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, color: '#ef4444' }}>⚠️ No stores found. Please add stores in the Management tab first.</div>}

        <div className="grid" style={{ gridTemplateColumns: '1fr', marginTop: 12, alignItems: 'center', gap: 8 }}>
          <select value={filter.storeId} onChange={e => setFilter(f => ({ ...f, storeId: e.target.value }))} title="Filter by store"
            style={{fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
            <option value="all">All Stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.storeName}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 8, padding: 12, background: 'rgba(110,231,240,0.08)', borderRadius: 8, border: '1px solid rgba(110,231,240,0.25)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div><strong>All Stores</strong>: Sales {allStoresTotal.salesSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Remit {allStoresTotal.remitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Diff {allStoresTotal.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {filter.storeId !== 'all' && <div><strong>Selected Store</strong>: Sales {filteredTotal.salesSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Remit {filteredTotal.remitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Diff {filteredTotal.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th><th>Store</th><th>Cashier</th><th>Sales</th><th>Remit</th><th>Total (Remit - Sales)</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => (
                <tr key={sale.id}>
                  <td>{sale.date}</td><td>{sale.storeName}</td><td>{sale.cashierName}</td>
                  {editingSaleId === sale.id ? (
                    <>
                      <td><input type="number" step="0.01" value={editingForm.sales} onChange={e => setEditingForm({ ...editingForm, sales: e.target.valueAsNumber })} style={{ width: '100px', fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222' }} /></td>
                      <td><input type="number" step="0.01" value={editingForm.remit} onChange={e => setEditingForm({ ...editingForm, remit: e.target.valueAsNumber })} style={{ width: '100px', fontSize: '1.05em', padding: '8px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222' }} /></td>
                      <td>{(editingForm.remit! - editingForm.sales!).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <form onSubmit={handleSaveEdit} style={{ display: 'inline', background:'#fff', padding:'10px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:8, boxShadow:'0 1px 4px #e0e3ea'}}>
                          <button type="submit">Save</button> <button type="button" onClick={cancelEdit}>Cancel</button>
                        </form>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{sale.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{sale.remit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{(sale.remit - sale.sales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(sale)}>Edit</button> <button onClick={() => handleDelete(sale.id)} style={{ background: '#ef4444' }}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredSales.length === 0 && <tr><td colSpan={7} style={{ color: '#666', textAlign: 'center' }}>No sales yet. Add one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}