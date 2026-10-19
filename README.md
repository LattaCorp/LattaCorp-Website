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

## CRM (Phase 1: leads inbox)
- Database: Supabase project `lvaofwtfxwlqwvzesckt` (leads table, staff list). Set it up once by running `supabase/schema.sql` in Supabase > SQL Editor.
- Website forms save a lead to the database AND email it. The server code needs the secret `SUPABASE_SECRET_KEY` in Cloudflare (Settings > Variables and Secrets > Secret). Never put the secret key in GitHub.
- The CRM page is at `/crm/` (`crm/index.html`). Staff sign in with email and password (create users in Supabase > Authentication > Users; turn off public sign-ups). Only emails listed in the `staff` table can see leads.
- Check status at `/api/health` (shows `crmKeySet: true` when the secret is set).
- Photos still arrive by email only. Saving photos in the CRM is the next step.

## Search-engine pages (SEO)

The site is one page that switches content with `#/` links, and Google ignores everything after the `#`. So `tools/build_seo_pages.py` saves
each important page (services, service areas, HOA pages, FAQs, About) as its own real page, in English (`/services/lawn-care/`) and Spanish (`/es/services/lawn-care/`),
with its own title, description, canonical link, language alternates, structured data, and writes `sitemap.xml`.
After changing page text in `index.html`, `js/data.js` or `js/i18n.js`, run `python3 tools/build_seo_pages.py` and commit the generated folders
(`services/`, `areas/`, `faqs/`, `about/`, `es/`, `sitemap.xml`). Titles and descriptions live at the top of that script.
