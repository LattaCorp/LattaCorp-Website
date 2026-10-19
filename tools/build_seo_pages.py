#!/usr/bin/env python3
"""Builds real, crawlable pages for search engines (English at /..., Spanish at /es/...).

The site itself is one page that switches content with #/ links. Google ignores everything after the #, so only the
home page could ever rank. This script opens the real site in a browser, grabs the finished content of each page
(services, service areas, HOA pages, FAQs, About), and saves it as its own HTML file with its own title,
description, canonical link, language alternates and structured data. It also writes sitemap.xml.

Run it again whenever page text in index.html, js/data.js or js/i18n.js changes:
    python3 tools/build_seo_pages.py
(Needs Python 3 with playwright installed; run from anywhere. Commit the generated folders.)"""
import json, os, re, shutil, subprocess, sys, time, datetime
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://lattacorpfl.com"
PORT = 8899
TODAY = datetime.date.today().isoformat()

# path (no slashes at ends), hash route, kind, EN description, ES description, EN title override, ES title override
PAGES = [
 ("services/lawn-care", "#/services/lawn-care", "service", "Lawn maintenance",
  "Weekly or biweekly lawn maintenance in Kissimmee, FL: mowing, edging, weed-whacking and blowing. Locally owned, licensed and insured. Call or text 407-470-5309.",
  "Mantenimiento de césped semanal o quincenal en Kissimmee, FL: corte, bordeado, recorte y soplado. Negocio local con licencia y seguro. Llame o envíe un texto al 407-470-5309."),
 ("services/tree-and-hedge-trimming", "#/services/trimming", "service", "Tree and hedge trimming",
  "Hedge, shrub, palm and oak trimming in Kissimmee, Campbell and Upper Poinciana. Careful crews, licensed and insured. Call or text 407-470-5309 for a quote.",
  "Poda de setos, arbustos, palmas y robles en Kissimmee, Campbell y Upper Poinciana. Equipo cuidadoso, con licencia y seguro. Llame o envíe un texto al 407-470-5309 para cotizar."),
 ("services/mulching", "#/services/mulching", "service", "Mulching",
  "Fresh mulch installed in your beds in Kissimmee, FL: clean, even coverage that holds moisture and tidies your yard. Send photos for a quick quote: 407-470-5309.",
  "Mulch nuevo en sus jardineras en Kissimmee, FL: cobertura limpia y pareja que retiene la humedad y mantiene su jardín ordenado. Envíe fotos para una cotización rápida: 407-470-5309."),
 ("areas/the-oaks", "#/services/areas/the-oaks", "area", "The Oaks, Kissimmee, FL",
  "Lawn care, trimming and mulching for The Oaks community in Kissimmee, FL. Most of our work is right here. Licensed and insured. Call or text 407-470-5309.",
  "Cuidado de césped, poda y mulch para la comunidad The Oaks en Kissimmee, FL. La mayor parte de nuestro trabajo es aquí. Con licencia y seguro. Llame o envíe un texto al 407-470-5309."),
 ("areas/central-kissimmee", "#/services/areas/central-kissimmee", "area", "Central Kissimmee, FL",
  "Lawn care, hedge trimming and mulching for homes and businesses in Central Kissimmee, FL. Locally owned, licensed and insured. Call or text 407-470-5309.",
  "Cuidado de césped, poda de setos y mulch para casas y negocios en el centro de Kissimmee, FL. Negocio local con licencia y seguro. Llame o envíe un texto al 407-470-5309."),
 ("areas/campbell", "#/services/areas/campbell", "area", "Campbell, Kissimmee, FL",
  "Lawn maintenance, trimming and mulching in Campbell, Kissimmee FL. Dependable, personal service from a local, licensed and insured crew. Call 407-470-5309.",
  "Mantenimiento de césped, poda y mulch en Campbell, Kissimmee FL. Servicio confiable y personal de un equipo local con licencia y seguro. Llame al 407-470-5309."),
 ("areas/upper-poinciana", "#/services/areas/upper-poinciana", "area", "Upper Poinciana, FL",
  "Lawn care, trimming and mulching in Upper Poinciana, FL for homes and communities. Local, licensed and insured. Call or text 407-470-5309 for a quote.",
  "Cuidado de césped, poda y mulch en Upper Poinciana, FL para casas y comunidades. Negocio local con licencia y seguro. Llame o envíe un texto al 407-470-5309 para cotizar."),
 ("services/hoa", "#/services/hoa", "hoa", "HOA maintenance",
  "HOA landscape maintenance in Kissimmee and Central Florida: mowing, trimming, mulching and clear communication for your board. Request a proposal.",
  "Mantenimiento de áreas verdes para HOA en Kissimmee y el centro de Florida: corte, poda, mulch y comunicación clara con su junta. Solicite una propuesta."),
 ("services/property-managers", "#/services/property-managers", "hoa", "Property managers",
  "Lawn and landscape maintenance for property managers in Kissimmee, FL. Dependable crews, clear communication, hassle-free. Request a proposal.",
  "Mantenimiento de césped y jardines para administradores de propiedades en Kissimmee, FL. Equipos confiables, comunicación clara y sin complicaciones. Solicite una propuesta."),
 ("services/landlords", "#/services/landlords", "hoa", "Landlords and rentals",
  "Lawn care for landlords and rental properties in Kissimmee, FL: keep tenants happy and properties looking sharp. Request a proposal: 407-470-5309.",
  "Cuidado de césped para propietarios y propiedades de alquiler en Kissimmee, FL: inquilinos contentos y propiedades impecables. Solicite una propuesta: 407-470-5309."),
 ("services/commercial", "#/services/commercial", "hoa", "Commercial properties",
  "Commercial lawn care in Kissimmee, FL: mowing, trimming and mulching for offices and businesses up to 15 miles from The Oaks. Request a proposal.",
  "Cuidado de césped comercial en Kissimmee, FL: corte, poda y mulch para oficinas y negocios hasta 15 millas de The Oaks. Solicite una propuesta."),
 ("faqs", "#/faqs", "info", "FAQs",
  "Answers about Latta Corp lawn care in Kissimmee, FL: how quotes work, service schedules, weather delays and more.",
  "Respuestas sobre el servicio de césped de Latta Corp en Kissimmee, FL: cómo funcionan las cotizaciones, los horarios de servicio, retrasos por clima y más."),
 ("about", "#/about", "info", "About us",
  "Meet Matteo Latalladi and the Latta Corp crew: a locally owned lawn care company serving The Oaks, Kissimmee, Campbell and Upper Poinciana, FL.",
  "Conozca a Matteo Latalladi y al equipo de Latta Corp: una empresa local de cuidado de césped que atiende The Oaks, Kissimmee, Campbell y Upper Poinciana, FL."),
]
TITLES = {  # page title (en, es) for every page
 "services/lawn-care": ("Lawn Maintenance in Kissimmee, FL | Latta Corp", "Mantenimiento de césped en Kissimmee, FL | Latta Corp"),
 "services/tree-and-hedge-trimming": ("Tree and Hedge Trimming in Kissimmee, FL | Latta Corp", "Poda de árboles y setos en Kissimmee, FL | Latta Corp"),
 "services/mulching": ("Mulching in Kissimmee, FL | Latta Corp", "Mantillo (mulch) en Kissimmee, FL | Latta Corp"),
 "areas/the-oaks": ("Lawn Care in The Oaks, Kissimmee, FL | Latta Corp", "Cuidado de césped en The Oaks, Kissimmee, FL | Latta Corp"),
 "areas/central-kissimmee": ("Lawn Care in Central Kissimmee, FL | Latta Corp", "Cuidado de césped en el centro de Kissimmee, FL | Latta Corp"),
 "areas/campbell": ("Lawn Care in Campbell, FL | Latta Corp", "Cuidado de césped en Campbell, FL | Latta Corp"),
 "areas/upper-poinciana": ("Lawn Care in Upper Poinciana, FL | Latta Corp", "Cuidado de césped en Upper Poinciana, FL | Latta Corp"),
 "services/hoa": ("HOA Lawn Maintenance in Kissimmee, FL | Latta Corp", "Mantenimiento de césped para HOA en Kissimmee, FL | Latta Corp"),
 "services/property-managers": ("Property Manager Lawn Care in Kissimmee, FL | Latta Corp", "Césped para administradores de propiedades, Kissimmee | Latta Corp"),
 "services/landlords": ("Landlord and Rental Lawn Care in Kissimmee, FL | Latta Corp", "Césped para propietarios y alquileres, Kissimmee | Latta Corp"),
 "services/commercial": ("Commercial Lawn Care in Kissimmee, FL | Latta Corp", "Cuidado de césped comercial en Kissimmee, FL | Latta Corp"),
 "faqs": ("Frequently Asked Questions | Latta Corp of Central Florida", "Preguntas frecuentes | Latta Corp of Central Florida"),
 "about": ("About Latta Corp | Lawn Care in Kissimmee, FL", "Sobre Latta Corp | Cuidado de césped en Kissimmee, FL"),
}
ROUTE_TO_PATH = {p[1]: p[0] for p in PAGES}
ROUTE_TO_PATH["#/services/trimming"] = "services/tree-and-hedge-trimming"


def url_for(path, lang):
    return f"{SITE}/{'es/' if lang == 'es' else ''}{path}/"


def fix_links(html, lang):
    pre = "/es" if lang == "es" else ""

    def hrefs(m):
        r = m.group(1)
        if r == "#/":
            return 'href="/"'
        if r in ROUTE_TO_PATH:
            return f'href="{pre}/{ROUTE_TO_PATH[r]}/"'
        return f'href="/{r}"'  # everything else lives in the main one-page site

    html = re.sub(r'href="(#/[^"]*)"', hrefs, html)
    html = re.sub(r'(src|href)="(images|css|js|assets)/', r'\1="/\2/', html)
    html = html.replace('href="favicon.ico"', 'href="/favicon.ico"')
    return html


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    home = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    biz = re.search(r'<script type="application/ld\+json" id="ld-biz">(.*?)</script>', home, re.S).group(1).strip()
    out_urls = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            for lang in ("en", "es"):
                ctx = b.new_context(viewport={"width": 1300, "height": 900})
                ctx.add_init_script(f"try{{localStorage.setItem('lang','{lang}')}}catch(e){{}}")
                for path, route, kind, name, d_en, d_es in PAGES:
                    pg = ctx.new_page()
                    pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
                    pg.goto(f"http://localhost:{PORT}/index.html{route}")
                    pg.wait_for_timeout(700)
                    got = pg.evaluate("""()=>{var r=document.documentElement.cloneNode(true);
                      r.querySelectorAll('script,#lb,noscript').forEach(function(e){e.remove()});
                      r.querySelectorAll('main.page:not(.on)').forEach(function(e){e.remove()});
                      var lg=r.querySelector('.lang');
                      return {body:r.querySelector('body').innerHTML,title:document.title,h1:(document.querySelector('main.on h1')||{}).textContent||''}}""")
                    pg.close()
                    body = got["body"]
                    title = got["title"].strip()
                    title = TITLES[path][0 if lang == "en" else 1]
                    desc = d_en if lang == "en" else d_es
                    alt_url = lambda l: url_for(path, l)
                    # language switch: two real links instead of the JS toggle
                    en_a = f'<a href="/{path}/" data-l="en" class="{"on" if lang == "en" else ""}" hreflang="en">EN</a>'
                    es_a = f'<a href="/es/{path}/" data-l="es" class="{"on" if lang == "es" else ""}" hreflang="es">ES</a>'
                    body = re.sub(r'<div class="lang">.*?</div>', f'<div class="lang">{en_a}<span aria-hidden="true">/</span>{es_a}</div>', body, count=1, flags=re.S)
                    body = fix_links(body, lang)
                    # breadcrumbs + page schema
                    crumbs = [("Home" if lang == "en" else "Inicio", f"{SITE}/")]
                    if path.startswith("areas/"):
                        crumbs.append(("Service areas" if lang == "en" else "Zonas de servicio", None))
                    elif path.startswith("services/"):
                        crumbs.append(("Services" if lang == "en" else "Servicios", f"{SITE}/#/services"))
                    crumbs.append((got["h1"].strip() or name, url_for(path, lang)))
                    bl = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                        {"@type": "ListItem", "position": i + 1, "name": n, **({"item": u} if u else {})} for i, (n, u) in enumerate(crumbs)]}
                    ld = [bl]
                    page_ld = {"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": url_for(path, lang),
                               "inLanguage": lang, "isPartOf": {"@type": "WebSite", "name": "Latta Corp of Central Florida", "url": SITE + "/"},
                               "about": {"@id": SITE + "/#business"}}
                    if kind in ("service", "area", "hoa"):
                        page_ld["@type"] = "WebPage"
                        svc = {"@context": "https://schema.org", "@type": "Service", "name": got["h1"].strip() or name,
                               "provider": {"@id": SITE + "/#business"}, "url": url_for(path, lang), "description": desc,
                               "areaServed": [{"@type": "City", "name": "Kissimmee", "containedInPlace": {"@type": "State", "name": "Florida"}}]}
                        if kind == "area":
                            svc["areaServed"] = [{"@type": "Place", "name": name}]
                        ld.append(svc)
                    ld.append(page_ld)
                    ld_html = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
                    ld_html += f'<script type="application/ld+json">{biz}</script>'
                    esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
                    alts = (f'<link rel="alternate" hreflang="en" href="{url_for(path, "en")}"><link rel="alternate" hreflang="es" href="{url_for(path, "es")}">'
                            f'<link rel="alternate" hreflang="x-default" href="{url_for(path, "en")}">')
                    head = (f'<!DOCTYPE html><html lang="{lang}"><head><meta charset="utf-8">'
                            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="light">'
                            f'<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">'
                            '<meta name="robots" content="index, follow, max-image-preview:large">'
                            f'<link rel="canonical" href="{url_for(path, lang)}">{alts}'
                            '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/images/favicon-192.png"><link rel="apple-touch-icon" href="/images/apple-touch-icon.png">'
                            '<meta name="theme-color" content="#1b552b"><meta name="geo.region" content="US-FL"><meta name="geo.placename" content="Kissimmee, Florida"><meta name="geo.position" content="28.2615;-81.4341"><meta name="ICBM" content="28.2615, -81.4341">'
                            f'<meta property="og:type" content="website"><meta property="og:site_name" content="Latta Corp of Central Florida"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
                            f'<meta property="og:url" content="{url_for(path, lang)}"><meta property="og:locale" content="{"es_US" if lang == "es" else "en_US"}">'
                            '<meta property="og:image" content="https://lattacorpfl.com/images/og-share.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(desc)}"><meta name="twitter:image" content="https://lattacorpfl.com/images/og-share.jpg">'
                            f'{ld_html}'
                            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                            '<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Lora:wght@400;600&display=swap" rel="stylesheet">'
                            '<link rel="stylesheet" href="/css/style.css"></head><body>')
                    html = head + body + '<script src="/js/static.js"></script></body></html>\n'
                    dest = os.path.join(ROOT, "es" if lang == "es" else "", path)
                    os.makedirs(dest, exist_ok=True)
                    open(os.path.join(dest, "index.html"), "w", encoding="utf-8").write(html)
                    out_urls.append((path, lang))
                ctx.close()
            b.close()
    finally:
        srv.terminate()

    # sitemap with language alternates
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
             f'  <url><loc>{SITE}/</loc><lastmod>{TODAY}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>']
    for path, route, kind, *_ in PAGES:
        pr = "0.9" if kind in ("service", "area") else "0.7"
        for lang in ("en", "es"):
            lines.append(f'  <url><loc>{url_for(path, lang)}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority>'
                         f'<xhtml:link rel="alternate" hreflang="en" href="{url_for(path, "en")}"/><xhtml:link rel="alternate" hreflang="es" href="{url_for(path, "es")}"/></url>')
    lines.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"wrote {len(out_urls)} pages and sitemap.xml")


if __name__ == "__main__":
    main()
