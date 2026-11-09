"""Builds the fill-in-the-blanks PDFs in the same design as the regular invoice (d/index.html):
  forms/custom-invoice.pdf   Custom invoice (Foreman > Billing > Custom invoice)
  forms/custom-estimate.pdf  Estimate / quote (Foreman > Jobs > New Estimate/Quote)
They are for documents made by hand; nothing typed into them is saved in Foreman.

Run:  python3 tools/build_custom_invoice_pdf.py
Needs reportlab and pypdf. Business name, phone, email and the thank-you line are set in BIZ below.
In PDF viewers that run form scripts (Adobe Acrobat/Reader, Chrome, Edge), money boxes format as dollars, the
summary's dates copy from the top boxes, and the totals add themselves up (invoice: Current Charges = the Amount
column, Total Amount Due = Previous Balance - Payments + Current Charges; estimate: Subtotal = the Amount column,
Estimated Total = Subtotal - Discount + Tax). In other viewers every box can be typed in.
Each document is described by a dict in DOCS below (title, boxes, columns, summary rows and totals).
"""
import io
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TREE = os.path.join(ROOT, "images", "logo-tree-header.png")
WORDMARK = os.path.join(ROOT, "images", "logo-wordmark-green.png")

BIZ = {
    "name": "LattaCorp of Central Florida",
    "phone": "407-470-5309",
    "email": "lattacorpofcentralfl@gmail.com",
    "footer": 'Thank you for letting us treat you lawn with a "Latta" love!',
}
DOCS = {
    "custom-invoice.pdf": {
        "name": "Custom Invoice",
        "title": "I N V O I C E", "title_size": 34,
        "boxes": [("Invoice Number", 1.0), ("Account Number", 1.0), ("Period Beginning", 1.05),
                  ("Period Ending", 1.0), ("Invoice Date", 0.95), ("Payment Due", 0.95)],
        "section": "Account Activity", "section_note": "Please keep this invoice for your records",
        "columns": [("Date", 64, 1), ("Location", 152, 0), ("Description", None, 0), ("Amount", 72, 2)],
        "lines": 16,
        "summary_title": "Invoice Summary",
        # (label, field name, kind): kind is "copy:<top box>", "money" or "total"
        "summary": [("Period Beginning", "Summary Period Beginning", "copy:Period Beginning"),
                    ("Period Ending", "Summary Period Ending", "copy:Period Ending"),
                    ("Previous Balance", "Previous Balance", "money"), ("Payments", "Payments", "money"),
                    ("Amount Overdue", "Amount Overdue", "red"), ("Current Charges", "Current Charges", "sum"),
                    ("Total Amount Due", "Total Amount Due", "total")],
        "total_js": 'event.value=v("Previous Balance")-Math.abs(v("Payments"))+v("Current Charges");',
        "who": "BILL TO", "who_fields": ["Bill To Name", "Bill To Line 2", "Bill To Account"],
        "approve": False,
    },
    "custom-estimate.pdf": {
        "name": "Estimate / Quote",
        "title": "E S T I M A T E  /  Q U O T E", "title_size": 24, "header": "outline",
        "boxes": [("Estimate Number", 1.0), ("Account Number", 1.0), ("Estimate Date", 1.0),
                  ("Valid Until", 1.0), ("Proposed Start", 1.0), ("Prepared By", 1.0)],
        "section": "Proposed Work", "section_note": "Prices are good through the Valid Until date",
        "columns": [("Qty", 44, 1), ("Location", 140, 0), ("Description", None, 0), ("Amount", 84, 2)],
        "lines": 12,
        "summary_title": "Estimate Summary",
        "summary": [("Estimate Date", "Summary Estimate Date", "copy:Estimate Date"),
                    ("Valid Until", "Summary Valid Until", "copy:Valid Until"),
                    ("Subtotal", "Subtotal", "sum"), ("Discount", "Discount", "money"), ("Tax", "Tax", "money"),
                    ("Deposit Required", "Deposit Required", "money"), ("Estimated Total", "Estimated Total", "total")],
        "total_js": 'event.value=v("Subtotal")-Math.abs(v("Discount"))+v("Tax");',
        "who": "PREPARED FOR", "who_fields": ["Prepared For Name", "Prepared For Line 2", "Prepared For Account"],
        "approve": True,
    },
}

FOREST = HexColor("#1b552b")
LEAF = HexColor("#2f7d3f")
MINT = HexColor("#eef6ec")
ROWALT = HexColor("#f3f8f1")
RULE = HexColor("#8fb08f")
INK = HexColor("#1d2a20")
MUTED = HexColor("#5b665e")
RED = HexColor("#b3261e")
DEEP = HexColor("#0f3a1b")

W, H = letter
M = 36  # page margin
X0, X1 = M, W - M
money_fields = []
aligned = []


def field(c, name, x, y, w, h, size=10, color=INK, align=0, multiline=False, tip=None):
    c.acroForm.textfield(
        name=name, tooltip=tip or name, x=x, y=y, width=w, height=h, fontName="Helvetica", fontSize=size,
        textColor=color, borderWidth=0, fillColor=None, borderColor=None, forceBorder=False,
        fieldFlags="multiline" if multiline else "", maxlen=0 if multiline else 200,
    )
    if align:
        aligned.append((name, align))


def build_base(doc):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle(doc["name"] + " · " + BIZ["name"])
    c.setAuthor(BIZ["name"])

    # ---- green header: tree logo, INVOICE, service address ----
    top = H - M
    hh = 84
    inv = doc.get("header") == "outline"  # white header inside a thick green border, green text
    if inv:
        bw = 7
        c.setFillColor(FOREST)
        c.roundRect(X0, top - hh, X1 - X0, hh, 6, stroke=0, fill=1)
        c.setFillColor(white)
        c.roundRect(X0 + bw, top - hh + bw, X1 - X0 - 2 * bw, hh - 2 * bw, 2, stroke=0, fill=1)
    else:
        c.setFillColor(FOREST)
        c.roundRect(X0, top - hh, X1 - X0, hh, 6, stroke=0, fill=1)
        c.setFillColor(white)
        c.roundRect(X0 + 16, top - hh + 16, 54, 52, 8, stroke=0, fill=1)
    c.drawImage(TREE, X0 + 21, top - hh + 20, width=44, height=44 * 168 / 181, mask="auto")
    c.setFillColor(FOREST if inv else white)
    c.setFont("Times-Bold", doc["title_size"])
    c.drawCentredString(W / 2, top - 40, doc["title"])
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(MUTED if inv else HexColor("#b9d8b6"))
    c.drawCentredString(W / 2, top - 55, "SERVICE ADDRESS")
    field(c, "Service Address", W / 2 - 150, top - 76, 300, 16, size=10, color=FOREST if inv else white, align=1)

    # ---- row of boxes ----
    y = top - hh - 14
    cols = doc["boxes"]
    tw = sum(w for _, w in cols)
    x = X0
    c.setLineWidth(0.6)
    for name, wt in cols:
        cw = (X1 - X0) * wt / tw
        c.setFillColor(FOREST)
        c.rect(x, y - 16, cw, 16, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(x + cw / 2, y - 11, name)
        c.setStrokeColor(RULE)
        c.rect(x, y - 36, cw, 20, stroke=1, fill=0)
        field(c, name, x + 3, y - 34, cw - 6, 16, size=10, align=1)
        x += cw
    y -= 36 + 16

    # ---- account activity ----
    c.setFillColor(FOREST)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(X0, y, doc["section"])
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(X1, y, doc["section_note"])
    y -= 6
    fixed = sum(cw for _, cw, _ in doc["columns"] if cw)
    lcols = [(n, cw if cw else (X1 - X0) - fixed, al) for n, cw, al in doc["columns"]]
    c.setFillColor(FOREST)
    c.rect(X0, y - 16, X1 - X0, 16, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    x = X0
    for name, cw, _ in lcols:
        c.drawCentredString(x + cw / 2, y - 11, name)
        x += cw
    y -= 16
    rh = 20
    for i in range(doc["lines"]):
        c.setFillColor(ROWALT if i % 2 else white)
        c.rect(X0, y - rh, X1 - X0, rh, stroke=0, fill=1)
        x = X0
        for name, cw, al in lcols:
            c.setStrokeColor(RULE)
            c.rect(x, y - rh, cw, rh, stroke=1, fill=0)
            fname = "%s %d" % (name, i + 1)
            if name == "Amount":
                field(c, fname, x + 3, y - rh + 2, cw - 6, rh - 4, size=9, align=2)
                money_fields.append(fname)
            elif name == "Description":
                field(c, fname, x + 3, y - rh + 1, cw - 6, rh - 2, size=9, multiline=True)
            else:
                field(c, fname, x + 3, y - rh + 2, cw - 6, rh - 4, size=9, align=al)
            x += cw
        y -= rh
    y -= 12

    # ---- bottom: bill to + contact + logo (left), invoice summary (right) ----
    sw = 220
    sx = X1 - sw
    srows = doc["summary"]
    srh = 24
    sh = 16 + srh * len(srows)
    c.setFillColor(FOREST)
    c.rect(sx, y - 16, sw, 16, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    kw = sw * 0.6
    c.drawString(sx + 6, y - 11, doc["summary_title"])
    c.drawRightString(X1 - 6, y - 11, "Totals")
    yy = y - 16
    for name, fname, kind in srows:
        tot = kind == "total"
        red = kind == "red"
        c.setFillColor(FOREST if tot else MINT)
        c.rect(sx, yy - srh, kw, srh, stroke=0, fill=1)
        c.setFillColor(FOREST if tot else white)
        c.rect(sx + kw, yy - srh, sw - kw, srh, stroke=0, fill=1)
        c.setStrokeColor(FOREST if tot else RULE)
        c.rect(sx, yy - srh, kw, srh, stroke=1, fill=0)
        c.rect(sx + kw, yy - srh, sw - kw, srh, stroke=1, fill=0)
        c.setFillColor(white if tot else (RED if red else HexColor("#26412c")))
        c.setFont("Helvetica-Bold", 10.5 if tot else 8.5)
        c.drawRightString(sx + kw - 6, yy - srh + 6.5, name)
        field(c, fname, sx + kw + 3, yy - srh + 3, sw - kw - 9, srh - 6, size=11 if tot else 9.5,
              color=white if tot else (RED if red else INK), align=2)
        if not kind.startswith("copy:"):
            money_fields.append(fname)
        yy -= srh
    bottom = y - sh

    # left side
    lx = X0
    ly = y - 4

    def block(title, lines_fields, static=None):
        nonlocal ly
        start = ly
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(lx + 10, ly - 7, title)
        ly -= 11
        if static:
            for i, txt in enumerate(static):
                c.setFillColor(FOREST if i == 0 else HexColor("#26412c"))
                c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 11 if i == 0 else 9.5)
                c.drawString(lx + 10, ly - 11, txt)
                ly -= 15 if i == 0 else 13
        for fname, size in lines_fields:
            field(c, fname, lx + 8, ly - 15, 230, 15, size=size, color=FOREST if size > 10 else INK)
            ly -= 16
        c.setFillColor(LEAF)
        c.rect(lx, ly - 2, 3, start - ly + 2, stroke=0, fill=1)
        ly -= 10

    wf = doc["who_fields"]
    block(doc["who"], [(wf[0], 11), (wf[1], 9.5), (wf[2], 9.5)])
    block("QUESTIONS? CONTACT US", [], static=[BIZ["name"], BIZ["phone"], BIZ["email"]])
    # green logo, centered in the left area, bottom level with Total Amount Due
    lw = 150
    lh = lw * 264 / 1194
    c.drawImage(WORDMARK, lx + ((sx - 18 - lx) - lw) / 2, bottom, width=lw, height=lh, mask="auto")

    foot_y = bottom - 30
    if doc["approve"]:
        # approval: the client signs and returns it (tall lines so there's room to write)
        ay = bottom - 24
        c.setFillColor(FOREST)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(X0, ay, "To approve this estimate, sign and return:")
        c.setStrokeColor(INK)
        c.setLineWidth(0.7)

        def sline(lab, x, wdt, y, fname=None):
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8)
            c.drawString(x, y, lab)
            lx0 = x + c.stringWidth(lab, "Helvetica", 8) + 6
            c.line(lx0, y - 3, x + wdt, y - 3)
            if fname:
                field(c, fname, lx0, y - 1, x + wdt - lx0, 20, size=11)

        ay -= 34
        sline("Signature", X0, X1 - X0, ay)
        ay -= 32
        sline("Printed name", X0, 330, ay, "Approved Printed name")
        sline("Date", X0 + 350, X1 - X0 - 350, ay, "Approved Date")
        foot_y = ay - 30

    # thank-you line
    c.setFillColor(DEEP)
    c.setFont("Times-BoldItalic", 13)
    c.drawCentredString(W / 2, foot_y, BIZ["footer"])

    c.showPage()
    c.save()
    return buf.getvalue()


def add_scripts(pdf_bytes, doc):
    """Dollar formatting, alignment, and the two auto-totals (for viewers that run form scripts)."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    writer.append(reader)
    af = writer._root_object["/AcroForm"]
    fields = {}
    for annot in writer.pages[0]["/Annots"]:
        a = annot.get_object()
        fields[a["/T"]] = a
    for name, q in aligned:
        fields[name][NameObject("/Q")] = __import__("pypdf").generic.NumberObject(q)
    fmt = 'AFNumber_Format(2, 0, 0, 0, "$", true);'
    keys = 'AFNumber_Keystroke(2, 0, 0, 0, "$", true);'
    for name in money_fields:
        f = fields[name]
        f[NameObject("/AA")] = DictionaryObject({
            NameObject("/F"): DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject(fmt)}),
            NameObject("/K"): DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject(keys)}),
        })
    amounts = ", ".join('"Amount %d"' % (i + 1) for i in range(doc["lines"]))
    calcs = {}
    for _, fname, kind in doc["summary"]:
        if kind.startswith("copy:"):
            calcs[fname] = 'event.value=this.getField("%s").value;' % kind[5:]
        elif kind == "sum":
            calcs[fname] = 'AFSimple_Calculate("SUM", new Array(%s));' % amounts
    for _, fname, kind in doc["summary"]:
        if kind == "total":
            calcs[fname] = 'var v=function(n){var x=this.getField(n).value;return x===""?0:Number(x)||0};' + doc["total_js"]
    order = []
    for name, js in calcs.items():
        if "/AA" not in fields[name]:
            fields[name][NameObject("/AA")] = DictionaryObject()
        aa = fields[name][NameObject("/AA")]
        aa[NameObject("/C")] = DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject(js)})
        order.append(fields[name].indirect_reference)
    af[NameObject("/CO")] = ArrayObject(order)
    af[NameObject("/NeedAppearances")] = __import__("pypdf").generic.BooleanObject(True)
    writer.add_metadata({"/Title": doc["name"] + " · " + BIZ["name"], "/Author": BIZ["name"]})
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "forms"), exist_ok=True)
    for fname, doc in DOCS.items():
        money_fields.clear()
        aligned.clear()
        data = add_scripts(build_base(doc), doc)
        out = os.path.join(ROOT, "forms", fname)
        with open(out, "wb") as f:
            f.write(data)
        print("wrote", out, len(data), "bytes")
