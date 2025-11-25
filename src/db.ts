import Dexie, { Table } from 'dexie'

export class AppDB extends Dexie {
  cheques!: Table<any, string>
  payees!: Table<any, string>
  sales!: Table<any, string>
  employees!: Table<any, string>
  stores!: Table<any, string>
  customers!: Table<any, string>
  debts!: Table<any, string>
  attendance!: Table<any, string>
  payrolls!: Table<any, string>

  constructor() {
    super('jumongdb-db')
    this.version(1).stores({
      cheques: 'id, dueDate, status, payer',
      payees: 'id, companyName, agentName'
    })
    // v2: add chequeNo and payeeId indexes
    this.version(2).stores({
      cheques: 'id, chequeNo, dueDate, status, payer, payeeId',
      payees: 'id, companyName, agentName'
    })
    // v3: add sales table
    this.version(3).stores({
      cheques: 'id, chequeNo, dueDate, status, payer, payeeId',
      payees: 'id, companyName, agentName',
      sales: 'id, date, storeId, cashierId'
    })
    // v4: add employees and stores tables
    this.version(5).stores({
      cheques: 'id, chequeNo, dueDate, status, payer, payeeId',
      payees: 'id, companyName, agentName',
      sales: 'id, date, storeId, cashierId',
      employees: 'id, name, position, storeId',
      stores: 'id, storeName',
      customers: 'id, name, mobile, address, email'
    })
    // v6: add debts table
    this.version(6).stores({
      cheques: 'id, chequeNo, dueDate, status, payer, payeeId',
      payees: 'id, companyName, agentName',
      sales: 'id, date, storeId, cashierId',
      employees: 'id, name, position, storeId',
      stores: 'id, storeName',
      customers: 'id, name, mobile, address, email',
      debts: 'id, date, entityType, entityId, entityName, type'
    })
    // v7: add attendance and payrolls tables
    this.version(8).stores({
      cheques: 'id, chequeNo, dueDate, status, payer, payeeId',
      payees: 'id, companyName, agentName',
      sales: 'id, date, storeId, cashierId',
      employees: 'id, name, position, storeId, sssNo, philhealthNo',
      stores: 'id, storeName',
      customers: 'id, name, mobile, address, email',
      debts: 'id, date, entityType, entityId, entityName, type',
      attendance: 'id, date, employeeId, employeeName',
      payrolls: 'id, weekEnding, employeeId, employeeName, paidDate'
    }).upgrade(async tx => {
      // Migrate existing employees to have active=true by default and add sssNo/philhealthNo fields
      const employees = await tx.table('employees').toArray()
      for (const emp of employees) {
        const update: any = {}
        if (emp.active === undefined) update.active = true
        if (emp.sssNo === undefined) update.sssNo = ''
        if (emp.philhealthNo === undefined) update.philhealthNo = ''
        if (Object.keys(update).length > 0) {
          await tx.table('employees').update(emp.id, update)
        }
      }
    })
    this.cheques = this.table('cheques')
    this.payees = this.table('payees')
    this.sales = this.table('sales')
    this.employees = this.table('employees')
    this.stores = this.table('stores')
    this.customers = this.table('customers')
    this.debts = this.table('debts')
    this.attendance = this.table('attendance')
    this.payrolls = this.table('payrolls')
  }
}


export const db = new AppDB();
// Expose Dexie and db for browser console access
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Dexie = Dexie;
  // @ts-ignore
  window.db = db;
}
