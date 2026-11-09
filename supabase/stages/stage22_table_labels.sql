-- LattaCorp CRM, Stage 22: a plain-English label on every table, shown in Supabase's Table Editor.
-- Labels only: nothing about the data or the app changes. Safe to run more than once.
comment on table public.leads            is 'WEBSITE → CRM › Leads: quote requests, service requests and job applications sent from lattacorpfl.com. Shown in the CRM Leads tab.';
comment on table public.clients          is 'CRM › Clients: one row per client account (name, phone, email, type, notes).';
comment on table public.client_contacts  is 'CRM › Clients: extra contacts on a client (spouse, board member, property manager...).';
comment on table public.properties       is 'CRM › Clients: service addresses. A client can have several; one is labeled Main.';
comment on table public.photos           is 'CRM › Photos: job, property and receipt photos, linked to a client, property, visit or expense. Files live in the photos storage bucket.';
comment on table public.services         is 'CRM › Jobs: the list of services you offer (mowing, edging...), used when creating jobs.';
comment on table public.jobs             is 'CRM › Jobs: recurring or one-time work for a client property, with price and frequency.';
comment on table public.visits           is 'CRM › Schedule: each scheduled or completed visit for a job (date, crew, done, weather delay).';
comment on table public.crew             is 'CRM › Schedule: crew members who receive daily routes (text-only or with a login).';
comment on table public.invoices         is 'CRM › Billing: one row per invoice (number, client, dates, total, status).';
comment on table public.invoice_items    is 'CRM › Billing: the line items on each invoice.';
comment on table public.invoice_payments is 'CRM › Billing: customer payments, applied to an invoice or on account.';
comment on table public.estimates        is 'CRM › Billing: estimates / quotes sent to clients.';
comment on table public.estimate_items   is 'CRM › Billing: the line items on each estimate.';
comment on table public.business         is 'CRM › Billing: business settings (name, phone, Zelle info, invoice terms and footer, price calculator rates). Single row.';
comment on table public.expenses         is 'CRM › Expenses: business expenses and receipts, used for the Tax Report.';
comment on table public.inventory_cats   is 'CRM › Inventory: inventory categories and their colors.';
comment on table public.inventory_items  is 'CRM › Inventory: items in stock, by category.';
comment on table public.personnel        is 'CRM › Personnel: employee records (owner-only access).';
comment on table public.personnel_pay    is 'CRM › Personnel: payroll payments to employees (owner-only).';
comment on table public.personnel_benefits is 'CRM › Personnel: benefits and allowances per employee (owner-only).';
comment on table public.personnel_docs   is 'CRM › Personnel: documents on file per employee (owner-only).';
comment on table public.todos            is 'CRM › To-Do: tasks and reminders.';
comment on table public.staff            is 'CRM › Team: who can sign in to the CRM and their role (owner or office).';
