// Export all data for backup
export async function exportAllData() {
  await db.open();
  const [cheques, payees, sales, employees, stores, customers, debts, attendance, payrolls] = await Promise.all([
    db.cheques.toArray(),
    db.payees.toArray(),
    db.sales.toArray(),
    db.employees.toArray(),
    db.stores.toArray(),
    db.customers.toArray(),
    db.debts.toArray(),
    db.attendance.toArray(),
    db.payrolls.toArray(),
  ]);
  return { cheques, payees, sales, employees, stores, customers, debts, attendance, payrolls };
}

// Import all data for restore (overwrites existing data)
export async function importAllData(data: any) {
  await db.open();
  // Clear all tables
  await Promise.all([
    db.cheques.clear(),
    db.payees.clear(),
    db.sales.clear(),
    db.employees.clear(),
    db.stores.clear(),
    db.customers.clear(),
    db.debts.clear(),
    db.attendance.clear(),
    db.payrolls.clear(),
  ]);
  // Bulk add
  if (data.cheques) await db.cheques.bulkAdd(data.cheques);
  if (data.payees) await db.payees.bulkAdd(data.payees);
  if (data.sales) await db.sales.bulkAdd(data.sales);
  if (data.employees) await db.employees.bulkAdd(data.employees);
  if (data.stores) await db.stores.bulkAdd(data.stores);
  if (data.customers) await db.customers.bulkAdd(data.customers);
  if (data.debts) await db.debts.bulkAdd(data.debts);
  if (data.attendance) await db.attendance.bulkAdd(data.attendance);
  if (data.payrolls) await db.payrolls.bulkAdd(data.payrolls);
}
import { db } from './db'
import Dexie from 'dexie'

// Customers
export type Customer = {
  id: string
  name: string
  mobile: string
  address?: string
  email?: string
}

// Debt tracking
export type DebtEntry = {
  id: string
  entityType: 'customer' | 'employee'
  entityId: string
  entityName: string
  type: 'charge' | 'payment'
  amount: number
  date: string // yyyy-MM-dd
  description?: string
}

// Attendance tracking
export type Attendance = {
  id: string
  employeeId: string
  employeeName: string
  date: string // yyyy-MM-dd
  multiplier: number // 0 = absent, 0.5 = half day, 0.9 = late 1hr, 1.0 = full day
  notes?: string
}

// Payroll record
export type Payroll = {
  id: string
  employeeId: string
  employeeName: string
  weekEnding: string // yyyy-MM-dd (Sunday date)
  mondayToSunday: string[] // Array of 7 dates
  attendance: { date: string; multiplier: number }[] // Daily attendance for the week
  rate: number // Daily rate (e.g., 500)
  grossPay: number // Sum of (rate × multiplier) for each day
  deductions: number // From debt tracker
  netPay: number // grossPay - deductions
  paidDate?: string // When actually paid
  status: 'pending' | 'paid'
}

export type Status = 'pending'|'paid'|'bounced'|'cancel'|'replacement'

export type Cheque = {
  id: string
  payer: string
  amount: number
  dueDate: string // yyyy-MM-dd
  status: Status
  notes?: string
  companyName?: string
  agent?: string
  mobile?: string
  chequeNo: number
  payeeId?: string
}

// Payees
export type Payee = {
  id: string
  companyName: string
  agentName: string
  mobile: string
}

// Employees and Stores
export type Employee = {
  id: string
  name: string
  position: string
  rate: number
  storeId: string
  active: boolean
  sssNo?: string
  philhealthNo?: string
}

export type Store = {
  id: string
  storeName: string
  address: string
  landline: string
}

// Store sales
export type StoreSale = {
  id: string
  storeId: string
  storeName: string
  cashierId: string
  cashierName: string
  sales: number
  remit: number
  date: string // yyyy-MM-dd
}

export async function loadPayees(): Promise<Payee[]> {
  await db.open();
  return db.payees.toArray()
}

export async function savePayee(item: Payee) {
  await db.payees.put(item)
}

export async function deletePayee(id: string) {
  await db.payees.delete(id)
}

export async function loadCheques(): Promise<Cheque[]> {
  await db.open();
  return db.cheques.toArray()
}

export async function saveCheque(item: Cheque) {
  await db.cheques.put(item)
}

export async function updateCheque(id: string, updates: Partial<Cheque>) {
  await db.cheques.update(id, updates)
}

export async function deleteCheque(id: string) {
  await db.cheques.delete(id)
}

export function newId(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Store Sales CRUD
export async function loadStoreSales(): Promise<StoreSale[]> {
  await db.open();
  return db.sales.toArray()
}

export async function saveStoreSale(item: StoreSale) {
  await db.sales.put(item)
}

export async function updateStoreSale(id: string, updates: Partial<StoreSale>) {
  await db.sales.update(id, updates)
}

export async function deleteStoreSale(id: string) {
  await db.sales.delete(id)
}

// Employees CRUD
export async function loadEmployees(): Promise<Employee[]> {
  await db.open();
  return db.employees.toArray()
}

export async function loadActiveEmployees(): Promise<Employee[]> {
  await db.open();
  const all = await db.employees.toArray()
  return all.filter(e => e.active !== false) // Default to active if field missing
}

export async function replaceAllEmployees(items: Employee[]) {
  await db.employees.clear()
  if (items.length) await db.employees.bulkPut(items)
}

export async function toggleEmployeeActive(id: string) {
  const emp = await db.employees.get(id)
  if (emp) {
    await db.employees.update(id, { active: !emp.active })
  }
}

// Stores CRUD
export async function loadStores(): Promise<Store[]> {
  await db.open();
  return db.stores.toArray()
}

export async function replaceAllStores(items: Store[]) {
  await db.stores.clear()
  if (items.length) await db.stores.bulkPut(items)
}

// Debt CRUD
export async function loadDebtEntries(): Promise<DebtEntry[]> {
  await db.open();
  return db.debts.toArray()
}

export async function saveDebtEntry(item: DebtEntry) {
  await db.debts.put(item)
}

export async function updateDebtEntry(id: string, updates: Partial<DebtEntry>) {
  await db.debts.update(id, updates)
}

export async function deleteDebtEntry(id: string) {
  await db.debts.delete(id)
}

// Get current debt balance for a customer or employee
export async function getDebtBalance(entityType: 'customer' | 'employee', entityId: string): Promise<number> {
  const entries = await db.debts
    .where({ entityType, entityId })
    .toArray()
  
  return entries.reduce((balance, entry) => {
    if (entry.type === 'charge') {
      return balance + entry.amount
    } else {
      return balance - entry.amount
    }
  }, 0)
}

// Attendance CRUD
export async function loadAttendance(): Promise<Attendance[]> {
  await db.open();
  return db.attendance.toArray()
}

export async function saveAttendance(item: Attendance) {
  await db.attendance.put(item)
}

export async function updateAttendance(id: string, updates: Partial<Attendance>) {
  await db.attendance.update(id, updates)
}

export async function deleteAttendance(id: string) {
  await db.attendance.delete(id)
}

// Get attendance for specific employee and date range
export async function getAttendanceForPeriod(employeeId: string, startDate: string, endDate: string): Promise<Attendance[]> {
  const all = await db.attendance.where('employeeId').equals(employeeId).toArray()
  return all.filter(a => a.date >= startDate && a.date <= endDate).sort((a, b) => a.date.localeCompare(b.date))
}

// Payroll CRUD
export async function loadPayrolls(): Promise<Payroll[]> {
  await db.open();
  return db.payrolls.toArray()
}

export async function savePayroll(item: Payroll) {
  await db.payrolls.put(item)
}

export async function updatePayroll(id: string, updates: Partial<Payroll>) {
  await db.payrolls.update(id, updates)
}

export async function deletePayroll(id: string) {
  await db.payrolls.delete(id)
}
// Customers CRUD
export async function loadCustomers(): Promise<Customer[]> {
  await db.open();
  return db.customers.toArray()
}

export async function saveCustomer(item: Customer) {
  await db.customers.put(item)
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  await db.customers.update(id, updates)
}

export async function deleteCustomer(id: string) {
  await db.customers.delete(id)
}
