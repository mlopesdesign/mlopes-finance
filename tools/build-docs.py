from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=colors.HexColor("#12304A"), alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.HexColor("#0E6980"), spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=colors.HexColor("#12304A"), spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13.2, textColor=colors.HexColor("#243746"), spaceAfter=5))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.3, leading=12.5, leftIndent=12, firstLineIndent=-7, bulletIndent=0, textColor=colors.HexColor("#243746"), spaceAfter=3))
styles.add(ParagraphStyle(name="CodeX", parent=styles["BodyText"], fontName="Courier", fontSize=8.5, leading=11, backColor=colors.HexColor("#EEF4F6"), borderPadding=4, spaceAfter=5))
styles.add(ParagraphStyle(name="FooterX", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, textColor=colors.HexColor("#637783"), alignment=TA_CENTER))

def inline(text):
    text = escape(text)
    out = []
    parts = text.split("`")
    for i, part in enumerate(parts):
        out.append(("<font name='Courier' size='8.5'>" + part + "</font>") if i % 2 else part)
    return "".join(out).replace("**", "")

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D7E3E7"))
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.drawCentredString(105 * mm, 9 * mm, f"MLopes Finance v0.12.2  |  Página {doc.page}")
    canvas.restoreState()

def parse_md(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    flow = []
    i = 0
    first = True
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("# "):
            flow.append(Paragraph(inline(line[2:]), styles["DocTitle"] if first else styles["H1x"]))
            first = False
            i += 1
            continue
        if line.startswith("## "):
            flow.append(Paragraph(inline(line[3:]), styles["H1x"]))
            i += 1
            continue
        if line.startswith("### "):
            flow.append(Paragraph(inline(line[4:]), styles["H2x"]))
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and lines[i + 1].strip().startswith("|---"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(set(c) <= set("-:") for c in cells):
                    rows.append([Paragraph(inline(c), styles["Bodyx"]) for c in cells])
                i += 1
            table = Table(rows, repeatRows=1, hAlign="LEFT", colWidths=None)
            table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#DCECF0")), ("TEXTCOLOR", (0,0), (-1,0), colors.HexColor("#12304A")), ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#B7CDD3")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
            flow.extend([Spacer(1, 3), table, Spacer(1, 5)])
            continue
        if line.startswith("- ") or line.startswith("* "):
            flow.append(Paragraph("- " + inline(line[2:]), styles["Bulletx"]))
            i += 1
            continue
        if len(line) > 2 and line[0].isdigit() and line[1:3] == ". ":
            flow.append(Paragraph(inline(line), styles["Bulletx"]))
            i += 1
            continue
        if line.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            flow.append(Paragraph(escape("\n".join(code)).replace("\n", "<br/>"), styles["CodeX"]))
            i += 1
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(("#", "- ", "* ", "|", "```")):
            para.append(lines[i].strip())
            i += 1
        flow.append(Paragraph(inline(" ".join(para)), styles["Bodyx"]))
    return flow

def build(source, target):
    doc = BaseDocTemplate(str(target), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=19*mm, title=source.stem)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=footer)])
    doc.build(parse_md(source))

build(ROOT / "docs" / "GUIA-RAPIDO.md", OUT / "GUIA-RAPIDO.pdf")
build(ROOT / "docs" / "MANUAL-DO-USUARIO.md", OUT / "MANUAL-DO-USUARIO.pdf")
print(f"PDFs gerados em {OUT}")
