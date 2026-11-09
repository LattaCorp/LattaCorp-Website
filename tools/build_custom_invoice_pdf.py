"""Builds forms/custom-invoice.pdf: a fill-in-the-blanks invoice in the same design as the regular invoice
(d/index.html). It is for one-off invoices made by hand; nothing typed into it is saved in Foreman.

Run:  python3 tools/build_custom_invoice_pdf.py
Needs reportlab and pypdf. Business name, phone, email and the thank-you line are set in BIZ below.
In PDF viewers that run form scripts (Adobe Acrobat/Reader, Chrome, Edge), money boxes format as dollars,
the summary's period dates copy from the top boxes, Current Charges adds up the Amount column, and
Total Amount Due = Previous Balance - Payments + Current Charges. In other viewers every box can be typed in.
"""
import io
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "forms", "custom-invoice.pdf")
TREE = os.path.join(ROOT, "images", "logo-tree-header.png")
WORDMARK = os.path.join(ROOT, "images", "logo-wordmark-green.png")

BIZ = {
    "name": "LattaCorp of Central Florida",
    "phone": "407-470-5309",
    "email": "lattacorpofcentralfl@gmail.com",
    "footer": 'Thank you for letting us treat you lawn with a "Latta" love!',
}
LINES = 16  # rows in Account Activity

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


def field(c, name, x, y, w, h, size=10, color=INK, align=0, multiline=False, tip=None):
    c.acroForm.textfield(
        name=name, tooltip=tip or name, x=x, y=y, width=w, height=h, fontName="Helvetica", fontSize=size,
        textColor=color, borderWidth=0, fillColor=None, borderColor=None, forceBorder=False,
        fieldFlags="multiline" if multiline else "", maxlen=0 if multiline else 200,
    )
    if align:
        aligned.append((name, align))


aligned = []


def build_base():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle("Custom Invoice · " + BIZ["name"])
    c.setAuthor(BIZ["name"])

    # ---- green header: tree logo, INVOICE, service address ----
    top = H - M
    hh = 84
    c.setFillColor(FOREST)
    c.roundRect(X0, top - hh, X1 - X0, hh, 6, stroke=0, fill=1)
    c.setFillColor(white)
    c.roundRect(X0 + 16, top - hh + 16, 54, 52, 8, stroke=0, fill=1)
    c.drawImage(TREE, X0 + 21, top - hh + 20, width=44, height=44 * 168 / 181, mask="auto")
    c.setFont("Times-Bold", 34)
    label = "I N V O I C E"
    c.drawCentredString(W / 2, top - 40, label)
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(HexColor("#b9d8b6"))
    c.drawCentredString(W / 2, top - 55, "SERVICE ADDRESS")
    field(c, "Service Address", W / 2 - 150, top - 76, 300, 16, size=10, color=white, align=1)

    # ---- row of boxes ----
    y = top - hh - 14
    cols = [("Invoice Number", 1.0), ("Account Number", 1.0), ("Period Beginning", 1.05),
            ("Period Ending", 1.0), ("Invoice Date", 0.95), ("Payment Due", 0.95)]
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
    c.drawString(X0, y, "Account Activity")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(X1, y, "Please keep this invoice for your records")
    y -= 6
    lcols = [("Date", 64), ("Location", 152), ("Description", 0), ("Amount", 72)]
    lcols[2] = ("Description", (X1 - X0) - 64 - 152 - 72)
    c.setFillColor(FOREST)
    c.rect(X0, y - 16, X1 - X0, 16, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    x = X0
    for name, cw in lcols:
        c.drawCentredString(x + cw / 2, y - 11, name)
        x += cw
    y -= 16
    rh = 20
    for i in range(LINES):
        c.setFillColor(ROWALT if i % 2 else white)
        c.rect(X0, y - rh, X1 - X0, rh, stroke=0, fill=1)
        x = X0
        for name, cw in lcols:
            c.setStrokeColor(RULE)
            c.rect(x, y - rh, cw, rh, stroke=1, fill=0)
            fname = "%s %d" % (name, i + 1)
            if name == "Amount":
                field(c, fname, x + 3, y - rh + 2, cw - 6, rh - 4, size=9, align=2)
                money_fields.append(fname)
            elif name == "Description":
                field(c, fname, x + 3, y - rh + 1, cw - 6, rh - 2, size=9, multiline=True)
            else:
                field(c, fname, x + 3, y - rh + 2, cw - 6, rh - 4, size=9, align=1 if name == "Date" else 0)
            x += cw
        y -= rh
    y -= 12

    # ---- bottom: bill to + contact + logo (left), invoice summary (right) ----
    sw = 220
    sx = X1 - sw
    srows = ["Period Beginning ", "Period Ending ", "Previous Balance", "Payments", "Amount Overdue",
             "Current Charges", "Total Amount Due"]
    srh = 24
    sh = 16 + srh * len(srows)
    c.setFillColor(FOREST)
    c.rect(sx, y - 16, sw, 16, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    kw = sw * 0.6
    c.drawString(sx + 6, y - 11, "Invoice Summary")
    c.drawRightString(X1 - 6, y - 11, "Totals")
    yy = y - 16
    for name in srows:
        tot = name == "Total Amount Due"
        c.setFillColor(FOREST if tot else MINT)
        c.rect(sx, yy - srh, kw, srh, stroke=0, fill=1)
        c.setFillColor(FOREST if tot else white)
        c.rect(sx + kw, yy - srh, sw - kw, srh, stroke=0, fill=1)
        c.setStrokeColor(FOREST if tot else RULE)
        c.rect(sx, yy - srh, kw, srh, stroke=1, fill=0)
        c.rect(sx + kw, yy - srh, sw - kw, srh, stroke=1, fill=0)
        c.setFillColor(white if tot else (RED if name == "Amount Overdue" else HexColor("#26412c")))
        c.setFont("Helvetica-Bold", 10.5 if tot else 8.5)
        c.drawRightString(sx + kw - 6, yy - srh + 6.5, name.strip())
        fname = name.strip() if not name.endswith(" ") else "Summary " + name.strip()
        field(c, fname, sx + kw + 3, yy - srh + 3, sw - kw - 9, srh - 6, size=11 if tot else 9.5,
              color=white if tot else (RED if name == "Amount Overdue" else INK), align=2)
        if name.strip() not in ("Period Beginning", "Period Ending"):
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

    block("BILL TO", [("Bill To Name", 11), ("Bill To Line 2", 9.5), ("Bill To Account", 9.5)])
    block("QUESTIONS? CONTACT US", [], static=[BIZ["name"], BIZ["phone"], BIZ["email"]])
    # green logo, centered in the left area, bottom level with Total Amount Due
    lw = 150
    lh = lw * 264 / 1194
    c.drawImage(WORDMARK, lx + ((sx - 18 - lx) - lw) / 2, bottom, width=lw, height=lh, mask="auto")

    # thank-you line
    c.setFillColor(DEEP)
    c.setFont("Times-BoldItalic", 13)
    c.drawCentredString(W / 2, bottom - 30, BIZ["footer"])

    c.showPage()
    c.save()
    return buf.getvalue()


def add_scripts(pdf_bytes):
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
    amounts = ", ".join('"Amount %d"' % (i + 1) for i in range(LINES))
    calcs = {
        "Summary Period Beginning": 'event.value=this.getField("Period Beginning").value;',
        "Summary Period Ending": 'event.value=this.getField("Period Ending").value;',
        "Current Charges": 'AFSimple_Calculate("SUM", new Array(%s));' % amounts,
        "Total Amount Due": (
            'var v=function(n){var x=this.getField(n).value;return x===""?0:Number(x)||0};'
            'event.value=v("Previous Balance")-Math.abs(v("Payments"))+v("Current Charges");'
        ),
    }
    order = []
    for name, js in calcs.items():
        if "/AA" not in fields[name]:
            fields[name][NameObject("/AA")] = DictionaryObject()
        aa = fields[name][NameObject("/AA")]
        aa[NameObject("/C")] = DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject(js)})
        order.append(fields[name].indirect_reference)
    af[NameObject("/CO")] = ArrayObject(order)
    af[NameObject("/NeedAppearances")] = __import__("pypdf").generic.BooleanObject(True)
    writer.add_metadata({"/Title": "Custom Invoice · " + BIZ["name"], "/Author": BIZ["name"]})
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


if __name__ == "__main__":
    data = add_scripts(build_base())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(data)
    print("wrote", OUT, len(data), "bytes")
