import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import type { Employee, Attendance, Payroll } from '../data';
import {
  newId,
  loadAttendance,
  saveAttendance,
  updateAttendance,
  getAttendanceForPeriod,
  loadPayrolls,
  savePayroll,
  updatePayroll,
  getDebtBalance,
  saveDebtEntry,
} from '../data';

type PayrollProps = {
  employees: Employee[];
};

export default function Payroll({ employees }: PayrollProps) {
  type Tab = 'attendance' | 'generate' | 'history';
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employeeDebts, setEmployeeDebts] = useState<Record<string, number>>({});
  const [deductInputs, setDeductInputs] = useState<Record<string, number>>({});
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    // Get current Sunday
    const today = new Date();
    const sunday = endOfWeek(today, { weekStartsOn: 1 });
    return format(sunday, 'yyyy-MM-dd');
  });
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAttendance().then(setAttendance);
    loadPayrolls().then(setPayrolls);
  }, []);

  // Load current debts for employees (used as hints for deduction inputs)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await Promise.all(
        employees.map(async (e) => ({ id: e.id, debt: Math.max(0, await getDebtBalance('employee', e.id)) }))
      );
      if (!mounted) return;
      const map: Record<string, number> = {};
      for (const { id, debt } of entries) map[id] = debt;
      setEmployeeDebts(map);
    })();
    return () => { mounted = false };
  }, [employees]);

  // Sort employees A-Z by name for consistent display (active only)
  const sortedEmployees = useMemo(() => {
    return [...employees].filter(e => e.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees]);

  // Calculate Monday-Sunday dates for selected week
  const weekDates = useMemo(() => {
    const sunday = parseISO(selectedWeek);
    const monday = addDays(sunday, -6);
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
  }, [selectedWeek]);

  // Get attendance for current week view
  const weekAttendance = useMemo(() => {
    return attendance.filter(a => weekDates.includes(a.date));
  }, [attendance, weekDates]);

  // Organize attendance by employee and date (active employees only)
  const attendanceGrid = useMemo(() => {
    const grid = new Map<string, Map<string, number>>();
    employees.filter(e => e.active !== false).forEach(emp => {
      const dateMap = new Map<string, number>();
      weekDates.forEach(date => dateMap.set(date, 0)); // Default to absent
      grid.set(emp.id, dateMap);
    });
    
    weekAttendance.forEach(att => {
      const dateMap = grid.get(att.employeeId);
      if (dateMap) {
        dateMap.set(att.date, att.multiplier);
      }
    });
    
    return grid;
  }, [employees, weekDates, weekAttendance]);

  async function handleMultiplierChange(employeeId: string, employeeName: string, date: string, multiplier: number) {
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === date);
    
    if (existing) {
      await updateAttendance(existing.id, { multiplier });
    } else {
      await saveAttendance({
        id: newId(),
        employeeId,
        employeeName,
        date,
        multiplier,
      });
    }
    
    setAttendance(await loadAttendance());
  }

  async function generatePayroll() {
    const monday = weekDates[0];
    const sunday = weekDates[6];
    
    const activeEmployees = employees.filter(e => e.active !== false);
    for (const emp of activeEmployees) {
      // Check if payroll already exists
      const existing = payrolls.find(
        p => p.employeeId === emp.id && p.weekEnding === sunday
      );
      if (existing) continue;
      
      // Get attendance for this week
      const empAttendance = await getAttendanceForPeriod(emp.id, monday, sunday);
      const attendanceMap = empAttendance.map(a => ({ date: a.date, multiplier: a.multiplier }));
      
      // Fill in missing dates with 0
      weekDates.forEach(date => {
        if (!attendanceMap.find(a => a.date === date)) {
          attendanceMap.push({ date, multiplier: 0 });
        }
      });
      attendanceMap.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate gross pay
      const grossPay = attendanceMap.reduce((sum, a) => sum + (emp.rate * a.multiplier), 0);

      // Use manual deduction input; clamp to available debt and gross
      const currentDebt = Math.max(0, employeeDebts[emp.id] ?? 0);
      const requested = Math.max(0, Number(deductInputs[emp.id] ?? 0));
      const deductions = Math.min(requested, currentDebt, grossPay);
      const netPay = grossPay - deductions;
      
      await savePayroll({
        id: newId(),
        employeeId: emp.id,
        employeeName: emp.name,
        weekEnding: sunday,
        mondayToSunday: weekDates,
        attendance: attendanceMap,
        rate: emp.rate,
        grossPay,
        deductions,
        netPay,
        status: 'pending',
      });
    }
    
    setPayrolls(await loadPayrolls());
    setActiveTab('history');
  }

  async function markPayrollPaid(id: string) {
    const payroll = payrolls.find(p => p.id === id);
    if (!payroll) return;
    if (payroll.status === 'paid') return;

    const paidDate = format(new Date(), 'yyyy-MM-dd');

    // Apply payroll deduction to employee debt as a payment entry
    const deduction = Math.max(0, payroll.deductions || 0);
    if (deduction > 0) {
      await saveDebtEntry({
        id: newId(),
        entityType: 'employee',
        entityId: payroll.employeeId,
        entityName: payroll.employeeName,
        type: 'payment',
        amount: deduction,
        date: paidDate,
        description: `Payroll deduction for week ending ${payroll.weekEnding}`,
      });
    }

    await updatePayroll(id, { status: 'paid', paidDate });
    setPayrolls(await loadPayrolls());
  }

  const filteredPayrolls = useMemo(() => {
    if (!selectedEmployee) return payrolls;
    return payrolls.filter(p => p.employeeId === selectedEmployee);
  }, [payrolls, selectedEmployee]);

  const sortedPayrolls = useMemo(() => {
    return [...filteredPayrolls].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
  }, [filteredPayrolls]);

  // Totals for current view (after filter)
  const totals = useMemo(() => {
    const list = filteredPayrolls;
    const gross = list.reduce((s, p) => s + (p.grossPay || 0), 0);
    const deductions = list.reduce((s, p) => s + (p.deductions || 0), 0);
    const net = list.reduce((s, p) => s + (p.netPay || 0), 0);
    return { count: list.length, gross, deductions, net };
  }, [filteredPayrolls]);

  function printHistorySummary() {
    const titleEmp = selectedEmployee
      ? (employees.find(e => e.id === selectedEmployee)?.name || 'Employee')
      : 'All Employees';
    const printWindow = window.open('', '', 'width=900,height=650');
    if (!printWindow) return;

    const rowsHtml = sortedPayrolls.map(p => `
      <tr>
        <td>${p.employeeName}</td>
        <td>${format(parseISO(p.weekEnding), 'MMM dd, yyyy')}</td>
        <td style="text-align:right">₱${p.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">-₱${p.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:600">₱${p.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td>${p.status}${p.paidDate ? ` · ${format(parseISO(p.paidDate), 'MMM dd')}` : ''}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Payroll Summary - ${titleEmp}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1 { text-align: center; margin: 0 0 8px; }
          h2 { text-align: center; margin: 0 0 20px; font-weight: normal; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
          th { background: #f5f5f5; }
          tfoot td { font-weight: 700; border-top: 2px solid #333; }
          .right { text-align: right; }
          .muted { color: #666; font-size: 0.9em; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Payroll Summary</h1>
        <h2 class="muted">${titleEmp} — Printed ${format(new Date(), 'MMM dd, yyyy hh:mm a')}</h2>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Week Ending</th>
              <th class="right">Gross</th>
              <th class="right">Deductions</th>
              <th class="right">Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" class="muted">No payroll records.</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Totals (${totals.count} record${totals.count === 1 ? '' : 's'})</td>
              <td class="right">₱${totals.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td class="right">-₱${totals.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td class="right">₱${totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }

  function printHistoryReceipt80() {
    const titleEmp = selectedEmployee
      ? (employees.find(e => e.id === selectedEmployee)?.name || 'Employee')
      : 'All Employees';
    const printWindow = window.open('', '', 'width=480,height=800');
    if (!printWindow) return;

    const maxWidth = 42; // characters per line for ~80mm paper
    const cut = (s: string) => (s || '').length > maxWidth ? (s || '').slice(0, maxWidth) : (s || '');
    const fmt = (n: number) => `₱${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const lines: string[] = [];
    lines.push('PAYROLL SUMMARY');
    lines.push(titleEmp);
    lines.push(format(new Date(), 'MMM dd, yyyy hh:mm a'));
    lines.push('------------------------------------------');

    if (sortedPayrolls.length === 0) {
      lines.push('No payroll records.');
    } else {
      for (const p of sortedPayrolls) {
        const dateStr = format(parseISO(p.weekEnding), 'MM/dd');
        lines.push(cut(`${dateStr} ${p.employeeName}`));
        lines.push(cut(` G:${fmt(p.grossPay)} D:${fmt(p.deductions)} N:${fmt(p.netPay)}`));
        const status = p.status + (p.paidDate ? ` ${format(parseISO(p.paidDate), 'MM/dd')}` : '');
        lines.push(cut(` Status: ${status}`));
        lines.push('------------------------------------------');
      }
    }

    lines.push(cut(`TOTAL G:${fmt(totals.gross)}`));
    lines.push(cut(`      D:${fmt(totals.deductions)}`));
    lines.push(cut(`      N:${fmt(totals.net)}`));
    lines.push(cut(`Records: ${totals.count}`));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Payroll 80mm</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          body { font-family: monospace; font-size: 12px; width: 76mm; margin: 0; }
          pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
        </style>
      </head>
      <body>
        <pre>${lines.join('\n')}</pre>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }

  function printPayslip(payroll: Payroll) {
    const employee = employees.find(e => e.id === payroll.employeeId);
    if (!employee) return;
    const currentDebt = Math.max(0, employeeDebts[employee.id] ?? 0);

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${payroll.employeeName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .summary { margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; }
          .summary div { margin: 8px 0; }
          .total { font-size: 1.2em; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
          .text-right { text-align: right; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>PAYSLIP</h1>
        <div style="margin: 20px 0;">
          <div><strong>Employee:</strong> ${payroll.employeeName}</div>
          <div><strong>Position:</strong> ${employee.position}</div>
          <div><strong>Pay Period:</strong> ${format(parseISO(payroll.mondayToSunday[0]), 'MMM dd, yyyy')} - ${format(parseISO(payroll.weekEnding), 'MMM dd, yyyy')}</div>
          <div><strong>Daily Rate:</strong> ₱${payroll.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div><strong>Current Debt Balance:</strong> ₱${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Hours</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payroll.attendance.map(a => {
              const date = parseISO(a.date);
              const hours = a.multiplier * 10;
              const amount = payroll.rate * a.multiplier;
              return `
                <tr>
                  <td>${format(date, 'MMM dd, yyyy')}</td>
                  <td>${format(date, 'EEEE')}</td>
                  <td>${hours.toFixed(1)}h</td>
                  <td class="text-right">₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <div><strong>Gross Pay:</strong> <span style="float: right;">₱${payroll.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
          <div><strong>Deductions:</strong> <span style="float: right;">-₱${payroll.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
          <div class="total"><strong>Net Pay:</strong> <span style="float: right;">₱${payroll.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        </div>
        
        <div style="margin-top: 60px;">
          <div style="display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 40%;">
              <div style="border-top: 1px solid #333; padding-top: 5px;">Employee Signature</div>
            </div>
            <div style="text-align: center; width: 40%;">
              <div style="border-top: 1px solid #333; padding-top: 5px;">Authorized Signature</div>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px; color: #666; font-size: 0.9em;">
          <p>Generated on ${format(new Date(), 'MMM dd, yyyy hh:mm a')}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  return (
    <div>
      <div className="tab-nav">
        <button
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Daily Attendance
        </button>
        <button
          className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate Payroll
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Payroll History
        </button>
      </div>

      {/* Daily Attendance Tab */}
      {activeTab === 'attendance' && (
        <section className="card">
          <h3>Weekly Attendance</h3>
          <div style={{ marginBottom: 16 }}>
            <label>
              Week Ending (Sunday):{' '}
              <input
                style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}
                type="date"
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
              />
            </label>
            <span style={{ marginLeft: 16, color: '#888' }}>
              {format(parseISO(weekDates[0]), 'MMM dd')} - {format(parseISO(selectedWeek), 'MMM dd, yyyy')}
            </span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>
                    Employee
                  </th>
                  {weekDates.map((date, i) => (
                    <th key={date} style={{ textAlign: 'center', minWidth: 90 }}>
                      <div>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
                      <div style={{ fontSize: '0.85em', fontWeight: 'normal' }}>
                        {format(parseISO(date), 'MM/dd')}
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map(emp => {
                  const empDateMap = attendanceGrid.get(emp.id);
                  const total = empDateMap
                    ? Array.from(empDateMap.values()).reduce((sum, m) => sum + m, 0)
                    : 0;
                  const totalPay = total * emp.rate;

                  return (
                    <tr key={emp.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg)', fontWeight: 500 }}>
                        <div>{emp.name}</div>
                        <div style={{ fontSize: '0.85em', color: '#888' }}>₱{emp.rate}/day</div>
                      </td>
                      {weekDates.map(date => {
                        const multiplier = empDateMap?.get(date) || 0;
                        return (
                          <td key={date} style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={multiplier}
                              onChange={e =>
                                handleMultiplierChange(
                                  emp.id,
                                  emp.name,
                                  date,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              style={{
                                width: 60,
                                textAlign: 'center',
                                padding: '4px',
                                background: multiplier === 0 ? '#fee' : multiplier < 1 ? '#ffe' : '#efe',
                              }}
                            />
                            <div style={{ fontSize: '0.75em', color: '#666', marginTop: 2 }}>
                              ₱{(multiplier * emp.rate).toFixed(0)}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        <div>{total.toFixed(1)} days</div>
                        <div style={{ color: '#6ee7f0' }}>₱{totalPay.toFixed(2)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: 'rgba(110,231,240,0.1)', borderRadius: 8 }}>
            <strong>Multiplier Guide:</strong> 1.0 = Full day (10hrs), 0.9 = Late 1hr (9hrs), 0.5 = Half day (5hrs), 0 = Absent
          </div>
        </section>
      )}

      {/* Generate Payroll Tab */}
      {activeTab === 'generate' && (
        <section className="card">
          <h3>Generate Payroll for Week Ending: {format(parseISO(selectedWeek), 'MMM dd, yyyy')}</h3>
          <p>This will generate payroll for all employees for the selected week.</p>
          
          <div style={{ marginTop: 16 }}>
            <label>
              Week Ending (Sunday):{' '}
              <input
                type="date"
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              onClick={generatePayroll}
              style={{
                padding: '12px 32px',
                fontSize: '1.1em',
                background: '#6ee7f0',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Generate Payroll for {employees.length} Employees
            </button>
          </div>

          <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <h4>Preview and Deductions:</h4>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Days</th>
                    <th>Gross</th>
                    <th style={{ minWidth: 140 }}>Deduct (Debt)</th>
                    <th>Current Debt</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map(emp => {
                    const empDateMap = attendanceGrid.get(emp.id);
                    const totalDays = empDateMap
                      ? Array.from(empDateMap.values()).reduce((sum, m) => sum + m, 0)
                      : 0;
                    const grossPay = totalDays * emp.rate;
                    const currentDebt = Math.max(0, employeeDebts[emp.id] ?? 0);
                    const inputVal = Number(deductInputs[emp.id] ?? 0);
                    const clamped = Math.min(Math.max(0, inputVal), Math.min(currentDebt, grossPay));
                    const net = grossPay - clamped;
                    return (
                      <tr key={emp.id}>
                        <td>{emp.name}</td>
                        <td>{totalDays.toFixed(1)}</td>
                        <td>₱{grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={inputVal}
                            onChange={e => setDeductInputs(d => ({ ...d, [emp.id]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                            style={{ width: 120 }}
                          />
                          <div style={{ fontSize: '0.8em', color: '#888' }}>
                            max ₱{Math.min(currentDebt, grossPay).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </div>
                        </td>
                        <td>₱{currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ fontWeight: 'bold', color: '#6ee7f0' }}>₱{net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{textAlign:'right', marginTop:12, fontWeight:'bold', fontSize:'1.1em'}}>
                Total Net Payout: ₱{
                  sortedEmployees.reduce((sum, emp) => {
                    const empDateMap = attendanceGrid.get(emp.id);
                    const totalDays = empDateMap
                      ? Array.from(empDateMap.values()).reduce((s, m) => s + m, 0)
                      : 0;
                    const grossPay = totalDays * emp.rate;
                    const currentDebt = Math.max(0, employeeDebts[emp.id] ?? 0);
                    const inputVal = Number(deductInputs[emp.id] ?? 0);
                    const clamped = Math.min(Math.max(0, inputVal), Math.min(currentDebt, grossPay));
                    const net = grossPay - clamped;
                    return sum + net;
                  }, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
                }
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Payroll History Tab */}
      {activeTab === 'history' && (
        <section className="card">
          <h3>Payroll History</h3>
          
          <div style={{ marginBottom: 16 }}>
            <label>
              Filter by Employee:{' '}
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
                style={{fontSize: '1.1em', padding: '10px', border: '1.5px solid #b0b8c9', borderRadius: 5, background: '#fff', color: '#222', marginBottom: 4}}>
                <option value="">All Employees</option>
                {sortedEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={printHistorySummary} style={{ marginLeft: 12 }}>Print Summary</button>
            <button onClick={printHistoryReceipt80} style={{ marginLeft: 8 }}>Print 80mm</button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Week Ending</th>
                  <th>Days</th>
                  <th>Gross Pay</th>
                  <th>Deductions</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayrolls.map(payroll => {
                  const totalDays = payroll.attendance.reduce((sum, a) => sum + a.multiplier, 0);
                  return (
                    <tr key={payroll.id}>
                      <td>{payroll.employeeName}</td>
                      <td>{format(parseISO(payroll.weekEnding), 'MMM dd, yyyy')}</td>
                      <td>{totalDays.toFixed(1)}</td>
                      <td>₱{payroll.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td>-₱{payroll.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 'bold', color: '#6ee7f0' }}>
                        ₱{payroll.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge ${payroll.status}`}>{payroll.status}</span>
                        {payroll.paidDate && (
                          <div style={{ fontSize: '0.85em', color: '#888' }}>
                            {format(parseISO(payroll.paidDate), 'MMM dd')}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => printPayslip(payroll)}>Print</button>
                        {payroll.status === 'pending' && (
                          <button
                            onClick={() => markPayrollPaid(payroll.id)}
                            style={{ marginLeft: 6 }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals summary */}
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(110,231,240,0.08)', borderRadius: 8, border: '1px solid rgba(110,231,240,0.25)' }}>
            <strong>Totals</strong>: Gross ₱{totals.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Deductions ₱{totals.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Net ₱{totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({totals.count} record{totals.count === 1 ? '' : 's'})
          </div>

          {sortedPayrolls.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
              No payroll records yet. Generate payroll from the "Generate Payroll" tab.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
