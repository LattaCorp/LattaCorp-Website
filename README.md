# Latta Corp of Central Florida — website

A plain HTML/CSS/JavaScript site. No build step: open `index.html` in a browser to preview it.

## Where things live

| To change… | Edit this |
|---|---|
| Page text (English) — Home, Services, Contact, About, FAQs, etc. | `index.html` (search for the sentence) |
| The Spanish version of any sentence | `js/i18n.js` — each English sentence is on the left, Spanish on the right. If you change an English sentence, change its left side here too, or it will show in English on the Spanish site. |
| Service pages, HOA / Property Manager / Landlord / Commercial pages, area pages, checklist options | `js/data.js` |
| Colors, fonts, spacing, layout, the palm-frond background | `css/style.css` (brand colors are the `--forest`, `--leaf`, `--mint` values at the top) |
| Menus, language switch, photo gallery pop-up | `js/app.js` |
| What the forms collect and how they are sent | `js/forms.js` (browser side) and `src/worker.js` (emails them to the business) |
| Where form emails go | `TO_EMAIL` in `wrangler.jsonc` |
| Swap a photo | Replace the file in `images/` with a new one **of the same file name**. Photo names are listed in `js/images.js`. |
| Logos | `images/logo-*.svg` / `.png` |
| Background art, job application PDF | `assets/` |

## Rules we follow
- No prices anywhere on the site.
- Every visible sentence has English and Spanish.
- Business details for Google (hours, service area, phone) are in the `<script type="application/ld+json">` block near the top of `index.html`.

## Before launch (to-do)
- Add the real domain: canonical link and `og:url` / `og:image` in `index.html`.
- Add real social media URLs to `"sameAs"` in the JSON-LD block.
- Forms email the business through Resend. The secret `RESEND_API_KEY` must be set in Cloudflare (Workers & Pages > lattacorp-website > Settings > Variables and Secrets). Until the domain is verified in Resend, emails come from onboarding@resend.dev and can only be sent to the Resend account owner's email. Later: save submissions into the CRM, and add Cloudflare Turnstile for stronger spam protection.
- Have a native Spanish speaker review `js/i18n.js`.

## Preview helper (optional)
`tools/build_preview.py` bundles the whole site into one file for the claude.ai preview. The live website does not use it.

## Checking the form code
`node test/worker.test.mjs` runs a quick automatic check of `src/worker.js`.

## CRM (Foreman, at `/crm/`)

### Where the CRM code lives
The CRM's code is split into one file per section in `crm/src/`. The browser loads one combined file, `crm/app.js`,
which is **generated**: never edit it directly. After changing anything in `crm/src/`, run `node tools/build_crm.mjs`;
it rebuilds `crm/app.js` and bumps the version numbers so phones pick up the change.

| Section | File in `crm/src/` |
|---|---|
| Shared settings, lists and data | `00-state.js` |
| Small tools used everywhere (buttons, fields, dates, money) | `01-helpers.js` |
| Sign in / out, loading data from Supabase | `02-signin-and-loading.js` |
| Side menu, tabs, pop-up side panel | `03-main-screen.js` |
| Leads | `04-leads.js` |
| Clients, other contacts, properties, CSV import | `05-clients.js` |
| Search box at the top | `06-search.js` |
| Jobs and services | `07-jobs.js` |
| Schedule, weather delays | `08-schedule.js` |
| Reminder messages | `09-reminders.js` |
| Team (logins) | `10-team.js` |
| Personnel | `11-personnel.js` |
| To-Do | `12-todo.js` |
| Reports and charts | `13-reports.js` |
| Expenses (tax ledger, receipt scan) | `14-expenses.js` |
| Tax Report | `15-tax-report.js` |
| Photos | `16-photos.js` |
| Crew routes and the crew screen | `17-crew.js` |
| Billing: invoices / payments / history import / Billing tab / client page | `18-` to `22-billing-*.js` |
| Price calculator and estimates form | `23-price-calculator.js` |
| Inventory | `24-inventory.js` |

Screens, colors and layout (CSS) are in `crm/index.html`. `crm/sw.js` keeps the app installable and opening fast.
Code style: formatted with Prettier (settings in `crm/src/.prettierrc`).

### Database (Supabase project `lvaofwtfxwlqwvzesckt`)
- Every table has a plain-English label in Supabase's Table Editor saying which part it belongs to, for example "CRM › Billing".
- `supabase/stages/` holds each database change in the order it was made (Stage 0 to Stage 24). New changes get the next stage number.
- `supabase/full_setup.sql` is all the stages in one file, for rebuilding the database from scratch. The live database is already set up.
- Website forms save a lead to the database AND email it. The server code needs the secret `SUPABASE_SECRET_KEY` in Cloudflare (Settings > Variables and Secrets > Secret). Never put the secret key in GitHub.
- Staff sign in with email and password (users in Supabase > Authentication > Users; public sign-ups off). Only emails in the `staff` table can see CRM data; Personnel is owners only.
- Check status at `/api/health` (shows `crmKeySet: true` when the secret is set).

## Client portal (at `/portal/`)
- Clients sign in with a one-time code emailed to them (no passwords; the code length is set in Supabase). The server (`src/worker.js`, `/api/portal/code`) only sends a
  code to the main email on a client, or to an Other contact with **Portal access** ticked in Foreman. Codes come from
  `website@lattacorpfl.com` through Resend, so the Resend domain must stay verified.
- What a client can see is decided in the database (`supabase/stages/stage23_client_portal.sql`): the lookups
  `portal_accounts()` and `portal_account(id)` return only that person's own account(s). CRM tables stay staff-only.
- Page files: `portal/index.html` (layout and styles) and `portal/portal.js` (sign-in, Home, Schedule, Billing, Requests,
  Photos, Account; English and Spanish). Requests from the portal arrive in CRM Leads and by email, marked "· Portal".
- In Foreman, each client page has a **Client portal** box: account status, who can sign in, **Send invite**, and **See their portal**.
- Staff view (Stage 24): anyone on the Team list can sign in to the portal with their own email and switch between every client's account to see exactly what that client sees. Sending requests is turned off in staff view.
- Info tab: guides live in `portal/guides.js` (English and Spanish). To add one (grass types, lawn damage...), copy a block there.
- Turnstile: when the site key is set in `js/forms.js`, also set it in `portal/portal.js` (`TURNSTILE_SITEKEY`).

## Search-engine pages (SEO)

The site is one page that switches content with `#/` links, and Google ignores everything after the `#`. So `tools/build_seo_pages.py` saves
each important page (services, service areas, HOA pages, FAQs, About) as its own real page, in English (`/services/lawn-care/`) and Spanish (`/es/services/lawn-care/`),
with its own title, description, canonical link, language alternates, structured data, and writes `sitemap.xml`.
After changing page text in `index.html`, `js/data.js` or `js/i18n.js`, run `python3 tools/build_seo_pages.py` and commit the generated folders
(`services/`, `areas/`, `faqs/`, `about/`, `es/`, `sitemap.xml`). Titles and descriptions live at the top of that script.
