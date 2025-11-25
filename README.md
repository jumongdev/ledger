# jumongDB

Local-first operations tracker for payees, employees, stores, store sales, and cheque due management — all in your browser with persistent storage.

# Ledger
Local-first operations tracker for payees, employees, stores, store sales, and cheque due management — all in your browser with persistent storage.

## Features

- Payees: Manage companies, agents, and contact numbers
- Employees: Add employees with positions (Cashier, Driver, Bagger) and link them to stores
- Stores: Maintain your store list for assignment and reporting
- Store Sales: Record daily sales and remittance, edit inline, delete, filter by store, auto-sort, and see totals
- Cheques: Track due dates and status (pending/paid/bounced/cancel/replacement), filter, search, sort, and edit inline
- Persistence: Data is saved to IndexedDB via Dexie, so it survives refresh and works offline
- Theme: Dark/light theme toggle

- Payees: Manage companies, agents, and contact numbers
- Employees: Add employees with positions (Cashier, Driver, Bagger) and link them to stores
- Stores: Maintain your store list for assignment and reporting

## Run Locally

```bash
npm install
npm run dev
```

Open the URL shown (typically http://localhost:5173).

This project is for accounting, payroll, and debt monitoring.

## Tech Stack

- Vite + React + TypeScript
- Dexie (IndexedDB) for local-first persistence
- date-fns for date handling
- Minimal CSS for styling

## Notes

- The internal database name and any legacy migration keys may still reference the original project identifier to avoid breaking existing data. Renaming them would create a new empty database unless a migration is performed.
