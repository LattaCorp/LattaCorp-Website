# Latta Corp of Central Florida — website

A plain HTML/CSS/JavaScript site. No build step: open `index.html` in a browser to preview it.

## Where things live

| To change… | Edit this |
|---|---|
| Page text (English) — Home, Services, Contact, About, FAQs, etc. | `index.html` (search for the sentence) |
| The Spanish version of any sentence | `js/i18n.js` — each English sentence is on the left, Spanish on the right. If you change an English sentence, change its left side here too, or it will show in English on the Spanish site. |
| Service pages, HOA / Property Manager / Landlord / Commercial pages, area pages, checklist options | `js/data.js` |
| Colors, fonts, spacing, layout, the palm-frond background | `css/style.css` (brand colors are the `--forest`, `--leaf`, `--mint` values at the top) |
| Menus, language switch, forms, photo gallery pop-up | `js/app.js` |
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
- Forms currently show a thank-you message only. They need to be connected to email and the CRM.
- Have a native Spanish speaker review `js/i18n.js`.

## Preview helper (optional)
`tools/build_preview.py` bundles the whole site into one file for the claude.ai preview. The live website does not use it.
