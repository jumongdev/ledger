import { db } from './db';
import { supabase } from './supabaseClient';

export async function migrateLocalToSupabase() {
  // Employees
  const employees = await db.employees.toArray();
  for (const emp of employees) {
    await supabase.from('employees').insert([{
      id: emp.id,
      name: emp.name,
      position: emp.position,
      store_id: emp.storeId,
      rate: emp.rate ?? null,
      active: emp.active ?? true,
      created_at: emp.created_at ?? null
    }]);
  }

  // Payees
  const payees = await db.payees.toArray();
  for (const payee of payees) {
    await supabase.from('payees').insert([{
      id: payee.id,
      name: payee.companyName,
      agent: payee.agentName,
      contact_number: payee.contactNumber ?? null,
      address: payee.address ?? null,
      created_at: payee.created_at ?? null
    }]);
  }

  // Stores
  const stores = await db.stores.toArray();
  for (const store of stores) {
    await supabase.from('stores').insert([{
      id: store.id,
      name: store.storeName,
      address: store.address ?? null,
      created_at: store.created_at ?? null
    }]);
  }

  // Debts
  const debts = await db.debts.toArray();
  for (const debt of debts) {
    await supabase.from('debts').insert([{
      id: debt.id,
      entity_type: debt.entityType,
      entity_id: debt.entityId,
      amount: debt.amount ?? null,
      type: debt.type,
      date: debt.date,
      description: debt.description ?? null,
      created_at: debt.created_at ?? null
    }]);
  }

  // Attendance
  const attendance = await db.attendance.toArray();
  for (const att of attendance) {
    await supabase.from('attendance').insert([{
      id: att.id,
      employee_id: att.employeeId,
      date: att.date,
      multiplier: att.multiplier ?? null,
      created_at: att.created_at ?? null
    }]);
  }

  // Payrolls
  const payrolls = await db.payrolls.toArray();
  for (const p of payrolls) {
    await supabase.from('payrolls').insert([{
      id: p.id,
      employee_id: p.employeeId,
      week_ending: p.weekEnding,
      gross_pay: p.grossPay ?? null,
      deductions: p.deductions ?? null,
      net_pay: p.netPay ?? null,
      status: p.status ?? null,
      paid_date: p.paidDate ?? null,
      created_at: p.created_at ?? null
    }]);
  }
}
