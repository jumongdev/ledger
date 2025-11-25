import React, { useState, useMemo } from 'react';
import type { Payee, Employee, Store, Customer } from '../data';
import { newId, loadPayees, savePayee, deletePayee, loadCustomers, saveCustomer, updateCustomer, deleteCustomer } from '../data';

type ManagementProps = {
  customers: Customer[];
  onCustomersChange: () => void;
  payees: Payee[];
  onPayeesChange: () => void;
  lastAddedPayeeId: string | null;
  payeeSort: { key: 'companyName' | 'agentName' | 'mobile'; dir: 'asc' | 'desc' };
  onTogglePayeeSort: (key: 'companyName' | 'agentName' | 'mobile') => void;
  sortedPayees: Payee[];
  employees: Employee[];
  onEmployeesChange: (employees: Employee[]) => void;
  onToggleEmployeeActive: (id: string) => void;
  stores: Store[];
  onStoresChange: (stores: Store[]) => void;
};

export default function Management({
  customers,
  onCustomersChange,
  payees,
  onPayeesChange,
  lastAddedPayeeId,
  payeeSort,
  onTogglePayeeSort,
  sortedPayees,
  employees,
  onEmployeesChange,
  onToggleEmployeeActive,
  stores,
  onStoresChange,
}: ManagementProps) {
  // Customers
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({});
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>({});
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [customers]);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    const item: Customer = {
      id: newId(),
      name: (customerForm.name || '').trim(),
      mobile: (customerForm.mobile || '').trim(),
      address: (customerForm.address || '').trim(),
      email: (customerForm.email || '').trim(),
    };
    await saveCustomer(item);
    onCustomersChange();
    setCustomerForm({});
  }

  async function removeCustomer(id: string) {
    await deleteCustomer(id);
    onCustomersChange();
  }

  function startEditCustomer(c: Customer) {
    setEditingCustomerId(c.id);
    setEditingCustomer({ name: c.name, mobile: c.mobile, address: c.address, email: c.email });
  }

  async function saveCustomerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomerId) return;
    await saveCustomer({
      id: editingCustomerId,
      name: (editingCustomer.name || '').trim(),
      mobile: (editingCustomer.mobile || '').trim(),
      address: (editingCustomer.address || '').trim(),
      email: (editingCustomer.email || '').trim(),
    });
    onCustomersChange();
    setEditingCustomerId(null);
    setEditingCustomer({});
  }

  function cancelCustomerEdit() {
    setEditingCustomerId(null);
    setEditingCustomer({});
  }
  type Tab = 'payees' | 'employees' | 'stores' | 'customers';
  const [activeTab, setActiveTab] = useState<Tab>('payees');
  const [payeeForm, setPayeeForm] = useState<Partial<Payee>>({});
  const [editingPayeeId, setEditingPayeeId] = useState<string | null>(null);
  const [editingPayee, setEditingPayee] = useState<Partial<Payee>>({});
  
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({});
  const [employeeFilter, setEmployeeFilter] = useState('');
  const sortedEmployeesLocal = useMemo(() => {
    const q = employeeFilter.trim().toLowerCase();
    return [...employees]
      .filter(e =>
        !q ||
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.position && e.position.toLowerCase().includes(q)) ||
        (e.sssNo && e.sssNo.toLowerCase().includes(q)) ||
        (e.philhealthNo && e.philhealthNo.toLowerCase().includes(q))
      )
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees, employeeFilter]);
  
  const [storeForm, setStoreForm] = useState<Partial<Store>>({});
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<Partial<Store>>({});

  // Payee handlers
  async function addPayee(e: React.FormEvent) {
    e.preventDefault();
    const item: Payee = {
      id: newId(),
      companyName: (payeeForm.companyName || '').trim(),
      agentName: (payeeForm.agentName || '').trim(),
      mobile: (payeeForm.mobile || '').trim(),
    };
    await savePayee(item);
    onPayeesChange();
    setPayeeForm({});
  }

  async function removePayee(id: string) {
    await deletePayee(id);
    onPayeesChange();
  }

  function startEditPayee(p: Payee) {
    setEditingPayeeId(p.id);
    setEditingPayee({ companyName: p.companyName, agentName: p.agentName, mobile: p.mobile });
  }

  async function savePayeeEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayeeId) return;
    await savePayee({
      id: editingPayeeId,
      companyName: (editingPayee.companyName || '').trim(),
      agentName: (editingPayee.agentName || '').trim(),
      mobile: (editingPayee.mobile || '').trim(),
    });
    onPayeesChange();
    setEditingPayeeId(null);
    setEditingPayee({});
  }

  function cancelPayeeEdit() {
    setEditingPayeeId(null);
    setEditingPayee({});
  }

  // Employee handlers
  function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.position || employeeForm.rate == null || !employeeForm.storeId) return;
    onEmployeesChange([
      ...employees,
      {
        id: newId(),
        name: employeeForm.name.trim(),
        position: employeeForm.position.trim(),
        rate: Number(employeeForm.rate),
        storeId: employeeForm.storeId,
        active: true,
        sssNo: employeeForm.sssNo || '',
        philhealthNo: employeeForm.philhealthNo || ''
      },
    ]);
    setEmployeeForm({});
  }

  function removeEmployee(id: string) {
    onEmployeesChange(employees.filter(e => e.id !== id));
  }

  function startEditEmployee(emp: Employee) {
    setEditingEmployeeId(emp.id);
    setEditingEmployee({ name: emp.name, position: emp.position, rate: emp.rate, storeId: emp.storeId, sssNo: emp.sssNo, philhealthNo: emp.philhealthNo });
  }

  function saveEmployeeEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployeeId) return;
    onEmployeesChange(
      employees.map(emp =>
        emp.id === editingEmployeeId
          ? {
              ...emp,
              name: (editingEmployee.name || '').trim(),
              position: (editingEmployee.position || '').trim(),
              rate: Number(editingEmployee.rate),
              storeId: editingEmployee.storeId || emp.storeId,
              sssNo: editingEmployee.sssNo || '',
              philhealthNo: editingEmployee.philhealthNo || ''
            }
          : emp
      )
    );
    setEditingEmployeeId(null);
    setEditingEmployee({});
  }

  function cancelEmployeeEdit() {
    setEditingEmployeeId(null);
    setEditingEmployee({});
  }

  // Store handlers
  function addStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeForm.storeName || !storeForm.address || !storeForm.landline) return;
    onStoresChange([
      ...stores,
      {
        id: newId(),
        storeName: storeForm.storeName.trim(),
        address: storeForm.address.trim(),
        landline: storeForm.landline.trim(),
      },
    ]);
    setStoreForm({});
  }

  function removeStore(id: string) {
    onStoresChange(stores.filter(s => s.id !== id));
  }

  function startEditStore(store: Store) {
    setEditingStoreId(store.id);
    setEditingStore({ storeName: store.storeName, address: store.address, landline: store.landline });
  }

  function saveStoreEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStoreId) return;
    onStoresChange(
      stores.map(s =>
        s.id === editingStoreId
          ? {
              ...s,
              storeName: (editingStore.storeName || '').trim(),
              address: (editingStore.address || '').trim(),
              landline: (editingStore.landline || '').trim(),
            }
          : s
      )
    );
    setEditingStoreId(null);
    setEditingStore({});
  }

  function cancelStoreEdit() {
    setEditingStoreId(null);
    setEditingStore({});
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-button ${activeTab === 'payees' ? 'active' : ''}`}
          onClick={() => setActiveTab('payees')}
        >
          Payees ({payees.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Employees ({employees.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          Stores ({stores.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customers ({customers.length})
        </button>
      </div>
      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <section className="card">
          <h3>Manage Customers</h3>
          <form onSubmit={addCustomer} className="grid" style={{background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea'}}>
            <input
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}
              required
              placeholder="Name"
              value={customerForm.name || ''}
              onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              required
              placeholder="Mobile"
              value={customerForm.mobile || ''}
              onChange={e => setCustomerForm(f => ({ ...f, mobile: e.target.value }))}
            />
            <input
              placeholder="Address"
              value={customerForm.address || ''}
              onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))}
            />
            <input
              placeholder="Email"
              value={customerForm.email || ''}
              onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))}
            />
            <button type="submit">Add Customer</button>
          </form>

          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Address</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.map(c =>
                  editingCustomerId === c.id ? (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontSize: '0.85em', color: '#888' }}>{c.id}</td>
                      <td>
                        <input
                          value={editingCustomer.name || ''}
                          onChange={e => setEditingCustomer(f => ({ ...f, name: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingCustomer.mobile || ''}
                          onChange={e => setEditingCustomer(f => ({ ...f, mobile: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingCustomer.address || ''}
                          onChange={e => setEditingCustomer(f => ({ ...f, address: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingCustomer.email || ''}
                          onChange={e => setEditingCustomer(f => ({ ...f, email: e.target.value }))}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <form onSubmit={saveCustomerEdit} style={{ display: 'inline', background:'#fff', padding:'10px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:8, boxShadow:'0 1px 4px #e0e3ea'}}>
                          <button type="submit">Save</button>
                        </form>
                        <button onClick={cancelCustomerEdit} style={{ marginLeft: 6 }}>
                          Cancel
                        </button>
                        <button className="danger" onClick={() => removeCustomer(c.id)} style={{ marginLeft: 6 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontSize: '0.85em', color: '#888' }}>{c.id}</td>
                      <td>{c.name}</td>
                      <td>{c.mobile}</td>
                      <td>{c.address}</td>
                      <td>{c.email}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEditCustomer(c)}>Edit</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {customers.length === 0 && <div style={{ padding: 8, color: '#666' }}>No customers yet. Add one above.</div>}
        </section>
      )}

      {/* Payees Tab */}
      {activeTab === 'payees' && (
        <section className="card">
          <h3>Manage Payees</h3>
          <form onSubmit={addPayee} className="grid" style={{background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea'}}>
            <input
              required
              placeholder="Company Name"
              value={payeeForm.companyName || ''}
              onChange={e => setPayeeForm(f => ({ ...f, companyName: e.target.value }))}
            />
            <input
              required
              placeholder="Agent Name"
              value={payeeForm.agentName || ''}
              onChange={e => setPayeeForm(f => ({ ...f, agentName: e.target.value }))}
            />
            <input
              required
              placeholder="Mobile"
              value={payeeForm.mobile || ''}
              onChange={e => setPayeeForm(f => ({ ...f, mobile: e.target.value }))}
            />
            <button type="submit">Add Payee</button>
          </form>

          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="th-btn" onClick={() => onTogglePayeeSort('companyName')}>
                      Company {payeeSort.key === 'companyName' ? (payeeSort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={() => onTogglePayeeSort('agentName')}>
                      Agent {payeeSort.key === 'agentName' ? (payeeSort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-btn" onClick={() => onTogglePayeeSort('mobile')}>
                      Mobile {payeeSort.key === 'mobile' ? (payeeSort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayees.map(p =>
                  editingPayeeId === p.id ? (
                    <tr key={p.id}>
                      <td>
                        <input
                          value={editingPayee.companyName || ''}
                          onChange={e => setEditingPayee(f => ({ ...f, companyName: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingPayee.agentName || ''}
                          onChange={e => setEditingPayee(f => ({ ...f, agentName: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingPayee.mobile || ''}
                          onChange={e => setEditingPayee(f => ({ ...f, mobile: e.target.value }))}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <form onSubmit={savePayeeEdit} style={{ display: 'inline', background:'#fff', padding:'10px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:8, boxShadow:'0 1px 4px #e0e3ea'}}>
                          <button type="submit">Save</button>
                        </form>
                        <button onClick={cancelPayeeEdit} style={{ marginLeft: 6 }}>
                          Cancel
                        </button>
                        <button className="danger" onClick={() => removePayee(p.id)} style={{ marginLeft: 6 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className={lastAddedPayeeId === p.id ? 'flash' : ''}>
                      <td>{p.companyName}</td>
                      <td>{p.agentName}</td>
                      <td>{p.mobile}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEditPayee(p)}>Edit</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {payees.length === 0 && <div style={{ padding: 8, color: '#666' }}>No payees yet. Add one above.</div>}
        </section>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <section className="card">
          <h3>Manage Employees</h3>
          <input
            placeholder="Search employee, SSS#, PhilHealth#..."
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            style={{marginBottom: 12, padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, fontSize: '1.05em'}}
          />
          <form onSubmit={addEmployee} className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea'}}>
            <input
              required
              placeholder="Name"
              value={employeeForm.name || ''}
              onChange={e => setEmployeeForm(f => ({ ...f, name: e.target.value }))}
            />
            <select
              style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}
              required
              value={employeeForm.position || ''}
              onChange={e => setEmployeeForm(f => ({ ...f, position: e.target.value }))}
            >
              <option value="">Select Position</option>
              <option value="Cashier">Cashier</option>
              <option value="Driver">Driver</option>
              <option value="Bagger">Bagger</option>
            </select>
            <input
              required
              type="number"
              step="0.01"
              placeholder="Rate"
              value={employeeForm.rate ?? ''}
              onChange={e => setEmployeeForm(f => ({ ...f, rate: e.target.valueAsNumber }))}
            />
            <select
              required
              value={employeeForm.storeId || ''}
              onChange={e => setEmployeeForm(f => ({ ...f, storeId: e.target.value }))}
            >
              <option value="">Select Store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
            <input
              placeholder="SSS #"
              value={employeeForm.sssNo || ''}
              onChange={e => setEmployeeForm(f => ({ ...f, sssNo: e.target.value }))}
            />
            <input
              placeholder="PhilHealth #"
              value={employeeForm.philhealthNo || ''}
              onChange={e => setEmployeeForm(f => ({ ...f, philhealthNo: e.target.value }))}
            />
            <button type="submit">Add Employee</button>
          </form>

          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Store</th>
                  <th>SSS #</th>
                  <th>PhilHealth #</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployeesLocal.map(emp =>
                  editingEmployeeId === emp.id ? (
                    <tr key={emp.id}>
                      <td className="mono" style={{ fontSize: '0.85em', color: '#888' }}>{emp.id}</td>
                      <td>
                        <input
                          value={editingEmployee.name || ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, name: e.target.value }))}
                        />
                      </td>
                      <td>
                        <select
                          value={editingEmployee.position || ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, position: e.target.value }))}
                        >
                          <option value="">Select Position</option>
                          <option value="Cashier">Cashier</option>
                          <option value="Driver">Driver</option>
                          <option value="Bagger">Bagger</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={editingEmployee.storeId || ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, storeId: e.target.value }))}
                        >
                          <option value="">Select Store</option>
                          {stores.map(store => (
                            <option key={store.id} value={store.id}>
                              {store.storeName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          placeholder="SSS #"
                          value={editingEmployee.sssNo || ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, sssNo: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          placeholder="PhilHealth #"
                          value={editingEmployee.philhealthNo || ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, philhealthNo: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEmployee.rate ?? ''}
                          onChange={e => setEditingEmployee(f => ({ ...f, rate: e.target.valueAsNumber }))}
                        />
                      </td>
                      <td>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.85em',
                          background: emp.active !== false ? 'rgba(100,200,100,0.2)' : 'rgba(200,100,100,0.2)',
                          color: emp.active !== false ? '#0a0' : '#a00'
                        }}>
                          {emp.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <form onSubmit={saveEmployeeEdit} style={{ display: 'inline', background:'#fff', padding:'10px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:8, boxShadow:'0 1px 4px #e0e3ea'}}>
                          <button type="submit">Save</button>
                        </form>
                        <button onClick={cancelEmployeeEdit} style={{ marginLeft: 6 }}>
                          Cancel
                        </button>
                        <button className="danger" onClick={() => removeEmployee(emp.id)} style={{ marginLeft: 6 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={emp.id} style={{ opacity: emp.active !== false ? 1 : 0.5 }}>
                      <td className="mono" style={{ fontSize: '0.85em', color: '#888' }}>{emp.id}</td>
                      <td>{emp.name}</td>
                      <td>{emp.position}</td>
                      <td>{stores.find(s => s.id === emp.storeId)?.storeName || 'N/A'}</td>
                      <td>{emp.sssNo || ''}</td>
                      <td>{emp.philhealthNo || ''}</td>
                      <td>{emp.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.85em',
                          background: emp.active !== false ? 'rgba(100,200,100,0.2)' : 'rgba(200,100,100,0.2)',
                          color: emp.active !== false ? '#0a0' : '#a00'
                        }}>
                          {emp.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEditEmployee(emp)}>Edit</button>
                        <button 
                          onClick={() => onToggleEmployeeActive(emp.id)} 
                          style={{ 
                            marginLeft: 6,
                            background: emp.active !== false ? 'rgba(200,100,100,0.8)' : 'rgba(100,200,100,0.8)'
                          }}
                        >
                          {emp.active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {employees.length === 0 && <div style={{ padding: 8, color: '#666' }}>No employees yet. Add one above.</div>}
        </section>
      )}

      {/* Stores Tab */}
      {activeTab === 'stores' && (
        <section className="card">
          <h3>Manage Stores</h3>
          <form onSubmit={addStore} className="grid" style={{background:'#fff', padding:'18px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:12, boxShadow:'0 1px 4px #e0e3ea'}}>
            <input
              required
              placeholder="Store Name"
              value={storeForm.storeName || ''}
              onChange={e => setStoreForm(f => ({ ...f, storeName: e.target.value }))}
            />
            <input
              required
              placeholder="Address"
              value={storeForm.address || ''}
              onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))}
            />
            <input
              required
              placeholder="Landline #"
              value={storeForm.landline || ''}
              onChange={e => setStoreForm(f => ({ ...f, landline: e.target.value }))}
            />
            <button type="submit">Add Store</button>
          </form>

          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Address</th>
                  <th>Landline #</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store =>
                  editingStoreId === store.id ? (
                    <tr key={store.id}>
                      <td>
                        <input
                          value={editingStore.storeName || ''}
                          onChange={e => setEditingStore(f => ({ ...f, storeName: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingStore.address || ''}
                          onChange={e => setEditingStore(f => ({ ...f, address: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          value={editingStore.landline || ''}
                          onChange={e => setEditingStore(f => ({ ...f, landline: e.target.value }))}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <form onSubmit={saveStoreEdit} style={{ display: 'inline', background:'#fff', padding:'10px', borderRadius:8, border:'1.5px solid #e0e3ea', marginBottom:8, boxShadow:'0 1px 4px #e0e3ea'}}>
                          <button type="submit">Save</button>
                        </form>
                        <button onClick={cancelStoreEdit} style={{ marginLeft: 6 }}>
                          Cancel
                        </button>
                        <button className="danger" onClick={() => removeStore(store.id)} style={{ marginLeft: 6 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={store.id}>
                      <td>{store.storeName}</td>
                      <td>{store.address}</td>
                      <td>{store.landline}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEditStore(store)}>Edit</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {stores.length === 0 && <div style={{ padding: 8, color: '#666' }}>No stores yet. Add one above.</div>}
        </section>
      )}
    </div>
  );
}
