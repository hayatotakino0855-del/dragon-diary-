"""検査日報レイアウト自動生成ツール — Webアプリ本体。

起動: uvicorn app.main:app --host 0.0.0.0 --port 8000
認証なし(社内LAN前提)。作成者名はテンプレートの author 欄に記録する。
"""
import io
import os
import shutil
import subprocess
import tempfile

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import db as D
from .engine.generator import auto_shrink, fit_report
from .schemas import (CHAR_TYPES, CharacteristicIn, CharMasterIn, CompanyIn,
                      ProductIn, TemplateIn)
from .service import generate_for_templates, load_template_spec

HERE = os.path.dirname(os.path.abspath(__file__))
app = FastAPI(title="検査日報レイアウト自動生成ツール")
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")
pages = Jinja2Templates(directory=os.path.join(HERE, "templates"))

D.init_db()


# ---------------------------------------------------------------- pages
@app.get("/", response_class=HTMLResponse)
def page_index(request: Request):
    return pages.TemplateResponse(request, "index.html", {})


@app.get("/templates/{template_id}/edit", response_class=HTMLResponse)
def page_edit(request: Request, template_id: int):
    return pages.TemplateResponse(request, "edit.html",
                                  {"template_id": template_id})


@app.get("/masters", response_class=HTMLResponse)
def page_masters(request: Request):
    return pages.TemplateResponse(request, "masters.html", {})


# ---------------------------------------------------------------- 一覧/検索
@app.get("/api/tree")
def api_tree(company: str = "", part_no: str = "", drawing_no: str = "",
             template: str = "", q: str = "", archived: int = 0):
    sql = """
    SELECT c.id AS company_id, c.name AS company_name,
           p.id AS product_id, p.part_no, p.drawing_no, p.material,
           p.container_qty_note, p.frequency_note,
           t.id AS template_id, t.name AS template_name, t.revision,
           t.archived, t.author, t.updated_at
    FROM company c
    LEFT JOIN product p ON p.company_id = c.id
    LEFT JOIN template t ON t.product_id = p.id AND t.archived <= ?
    WHERE 1=1"""
    args = [archived]
    if company:
        sql += " AND c.name LIKE ?"; args.append(f"%{company}%")
    if part_no:
        sql += " AND p.part_no LIKE ?"; args.append(f"%{part_no}%")
    if drawing_no:
        sql += " AND p.drawing_no LIKE ?"; args.append(f"%{drawing_no}%")
    if template:
        sql += " AND t.name LIKE ?"; args.append(f"%{template}%")
    if q:
        sql += (" AND (c.name LIKE ? OR p.part_no LIKE ? OR p.drawing_no LIKE ?"
                " OR t.name LIKE ? OR p.material LIKE ?)")
        args += [f"%{q}%"] * 5
    sql += " ORDER BY c.name, p.part_no, t.archived, t.name, t.revision DESC"
    with D.db() as con:
        return D.rows(con, sql, args)


# ---------------------------------------------------------------- company
@app.get("/api/companies")
def list_companies():
    with D.db() as con:
        return D.rows(con, "SELECT * FROM company ORDER BY name")


@app.post("/api/companies")
def create_company(body: CompanyIn):
    with D.db() as con:
        cur = con.execute("INSERT INTO company(name, note) VALUES(?,?)",
                          (body.name, body.note))
        return {"id": cur.lastrowid}


@app.put("/api/companies/{cid}")
def update_company(cid: int, body: CompanyIn):
    with D.db() as con:
        con.execute("UPDATE company SET name=?, note=? WHERE id=?",
                    (body.name, body.note, cid))
        return {"ok": True}


@app.delete("/api/companies/{cid}")
def delete_company(cid: int):
    with D.db() as con:
        con.execute("DELETE FROM company WHERE id=?", (cid,))
        return {"ok": True}


# ---------------------------------------------------------------- product
@app.get("/api/products")
def list_products(company_id: int | None = None):
    with D.db() as con:
        if company_id:
            return D.rows(con, "SELECT * FROM product WHERE company_id=? "
                               "ORDER BY part_no", (company_id,))
        return D.rows(con, "SELECT * FROM product ORDER BY part_no")


@app.post("/api/products")
def create_product(body: ProductIn):
    with D.db() as con:
        cur = con.execute(
            "INSERT INTO product(company_id, part_no, drawing_no, material,"
            " container_qty_note, frequency_note) VALUES(?,?,?,?,?,?)",
            (body.company_id, body.part_no, body.drawing_no, body.material,
             body.container_qty_note, body.frequency_note))
        return {"id": cur.lastrowid}


@app.put("/api/products/{pid}")
def update_product(pid: int, body: ProductIn):
    with D.db() as con:
        con.execute(
            "UPDATE product SET company_id=?, part_no=?, drawing_no=?,"
            " material=?, container_qty_note=?, frequency_note=? WHERE id=?",
            (body.company_id, body.part_no, body.drawing_no, body.material,
             body.container_qty_note, body.frequency_note, pid))
        return {"ok": True}


@app.delete("/api/products/{pid}")
def delete_product(pid: int):
    with D.db() as con:
        con.execute("DELETE FROM product WHERE id=?", (pid,))
        return {"ok": True}


# ---------------------------------------------------------------- template
def _template_out(con, tid):
    t = D.one(con, "SELECT * FROM template WHERE id=?", (tid,))
    if not t:
        raise HTTPException(404, "template not found")
    t["characteristics"] = D.rows(
        con, "SELECT * FROM characteristic WHERE template_id=? "
             "ORDER BY sort_order, id", (tid,))
    t["product"] = D.one(con, "SELECT * FROM product WHERE id=?",
                         (t["product_id"],))
    return t


@app.get("/api/templates/{tid}")
def get_template(tid: int):
    with D.db() as con:
        return _template_out(con, tid)


def _save_characteristics(con, tid, chars):
    con.execute("DELETE FROM characteristic WHERE template_id=?", (tid,))
    for i, c in enumerate(chars):
        if c.type not in CHAR_TYPES:
            raise HTTPException(400, f"不正な特性タイプ: {c.type}")
        con.execute(
            "INSERT INTO characteristic(template_id, sort_order, number, name,"
            " type, center_value, tolerance, unit, sub_name, sub_tolerance,"
            " criteria, axis_step, axis_range)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (tid, i, c.number, c.name, c.type, c.center_value, c.tolerance,
             c.unit, c.sub_name, c.sub_tolerance, c.criteria,
             c.axis_step, c.axis_range))


def _fit_warnings(con, tid):
    spec, _, _ = load_template_spec(con, tid)
    return [f"1ページに収まりません(高さ {r['height']} / 上限 {r['budget']})。"
            "軸延長範囲の短縮か項目削減を検討してください。"
            for r in fit_report([spec]) if not r["fits"]]


@app.post("/api/products/{pid}/templates")
def create_template(pid: int, body: TemplateIn):
    with D.db() as con:
        if not D.one(con, "SELECT id FROM product WHERE id=?", (pid,)):
            raise HTTPException(404, "product not found")
        cur = con.execute(
            "INSERT INTO template(product_id, name, sheet_name, special_notes,"
            " date_label, author, updated_at) VALUES(?,?,?,?,?,?,?)",
            (pid, body.name, body.sheet_name, body.special_notes,
             body.date_label, body.author, D.now()))
        tid = cur.lastrowid
        _save_characteristics(con, tid, body.characteristics)
        return {"id": tid, "warnings": _fit_warnings(con, tid)}


@app.put("/api/templates/{tid}")
def update_template(tid: int, body: TemplateIn):
    with D.db() as con:
        if not D.one(con, "SELECT id FROM template WHERE id=?", (tid,)):
            raise HTTPException(404, "template not found")
        con.execute(
            "UPDATE template SET name=?, sheet_name=?, special_notes=?,"
            " date_label=?, author=?, updated_at=? WHERE id=?",
            (body.name, body.sheet_name, body.special_notes,
             body.date_label, body.author, D.now(), tid))
        _save_characteristics(con, tid, body.characteristics)
        return {"ok": True, "warnings": _fit_warnings(con, tid)}


@app.delete("/api/templates/{tid}")
def delete_template(tid: int):
    with D.db() as con:
        con.execute("DELETE FROM template WHERE id=?", (tid,))
        return {"ok": True}


@app.post("/api/templates/{tid}/duplicate")
def duplicate_template(tid: int, as_revision: bool = Body(False, embed=True),
                       author: str = Body("", embed=True)):
    """複製。as_revision=true なら図面改訂: 旧版をアーカイブして改訂番号+1。"""
    with D.db() as con:
        t = _template_out(con, tid)
        if as_revision:
            con.execute("UPDATE template SET archived=1 WHERE id=?", (tid,))
            name, rev = t["name"], t["revision"] + 1
        else:
            name, rev = t["name"] + " (複製)", 1
        cur = con.execute(
            "INSERT INTO template(product_id, name, sheet_name, special_notes,"
            " date_label, revision, author, updated_at) VALUES(?,?,?,?,?,?,?,?)",
            (t["product_id"], name, t["sheet_name"], t["special_notes"],
             t["date_label"], rev, author or t["author"], D.now()))
        new_id = cur.lastrowid
        for c in t["characteristics"]:
            con.execute(
                "INSERT INTO characteristic(template_id, sort_order, number,"
                " name, type, center_value, tolerance, unit, sub_name,"
                " sub_tolerance, criteria, axis_step, axis_range)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (new_id, c["sort_order"], c["number"], c["name"], c["type"],
                 c["center_value"], c["tolerance"], c["unit"], c["sub_name"],
                 c["sub_tolerance"], c["criteria"], c["axis_step"],
                 c["axis_range"]))
        return {"id": new_id}


@app.post("/api/templates/{tid}/auto-shrink")
def api_auto_shrink(tid: int):
    """1ページ超過時に軸延長範囲を自動短縮してDBへ反映する。"""
    with D.db() as con:
        spec, _, _ = load_template_spec(con, tid)
        changed = auto_shrink(spec)
        if changed:
            chars = D.rows(con, "SELECT id FROM characteristic WHERE"
                                " template_id=? ORDER BY sort_order, id", (tid,))
            for row, c in zip(chars, spec["characteristics"]):
                con.execute("UPDATE characteristic SET axis_range=? WHERE id=?",
                            (c.get("axis_range"), row["id"]))
        return {"changed": changed, "warnings": _fit_warnings(con, tid)}


# ---------------------------------------------------------------- 出力
@app.get("/api/export")
def export_xlsx(ids: str = Query(..., description="テンプレートIDをカンマ区切り")):
    """1テンプレート=1ファイル、または内輪+外輪を1ブック複数シートで出力。"""
    template_ids = [int(x) for x in ids.split(",") if x.strip()]
    with D.db() as con:
        try:
            wb, filename, warnings = generate_for_templates(con, template_ids)
        except KeyError as e:
            raise HTTPException(404, str(e))
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    from urllib.parse import quote
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        "X-Warnings": quote("\n".join(warnings)),
    }
    return StreamingResponse(
        buf, headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ---------------------------------------------------------------- プレビュー
def _soffice():
    return shutil.which("libreoffice") or shutil.which("soffice")


@app.get("/api/templates/{tid}/preview")
def preview(tid: int):
    """サーバーでExcel生成→PDF変換(LibreOffice)。無い場合はHTML簡易プレビュー。"""
    with D.db() as con:
        wb, filename, warnings = generate_for_templates(con, [tid])
    exe = _soffice()
    if exe:
        with tempfile.TemporaryDirectory() as td:
            xlsx = os.path.join(td, "p.xlsx")
            wb.save(xlsx)
            r = subprocess.run([exe, "--headless", "--convert-to", "pdf",
                                "--outdir", td, xlsx],
                               capture_output=True, timeout=120)
            pdf = os.path.join(td, "p.pdf")
            if r.returncode == 0 and os.path.exists(pdf):
                with open(pdf, "rb") as f:
                    return Response(f.read(), media_type="application/pdf")
    from .preview_html import worksheet_to_html
    html = worksheet_to_html(wb.worksheets[0], warnings)
    return HTMLResponse(html)


# ---------------------------------------------------------------- 特性マスタ
@app.get("/api/char-masters")
def list_char_masters():
    with D.db() as con:
        return D.rows(con, "SELECT * FROM char_master ORDER BY name")


@app.post("/api/char-masters")
def create_char_master(body: CharMasterIn):
    if body.type not in CHAR_TYPES:
        raise HTTPException(400, f"不正な特性タイプ: {body.type}")
    with D.db() as con:
        cur = con.execute(
            "INSERT INTO char_master(name, type, center_value, tolerance, unit,"
            " sub_name, sub_tolerance, criteria) VALUES(?,?,?,?,?,?,?,?)",
            (body.name, body.type, body.center_value, body.tolerance, body.unit,
             body.sub_name, body.sub_tolerance, body.criteria))
        return {"id": cur.lastrowid}


@app.put("/api/char-masters/{mid}")
def update_char_master(mid: int, body: CharMasterIn):
    with D.db() as con:
        con.execute(
            "UPDATE char_master SET name=?, type=?, center_value=?, tolerance=?,"
            " unit=?, sub_name=?, sub_tolerance=?, criteria=? WHERE id=?",
            (body.name, body.type, body.center_value, body.tolerance, body.unit,
             body.sub_name, body.sub_tolerance, body.criteria, mid))
        return {"ok": True}


@app.delete("/api/char-masters/{mid}")
def delete_char_master(mid: int):
    with D.db() as con:
        con.execute("DELETE FROM char_master WHERE id=?", (mid,))
        return {"ok": True}


# ---------------------------------------------------------------- サンプル投入
@app.post("/api/seed")
def seed():
    """基準Excel相当のサンプルデータ(KO-5155B-HT / 6212RSH2 SET)を投入する。"""
    from samples.make_samples import build
    gairin, nairin = build()
    with D.db() as con:
        if D.one(con, "SELECT id FROM product WHERE drawing_no=?",
                 ("KO-5155B-HT",)):
            return {"ok": False, "message": "サンプルは投入済みです"}
        c = con.execute("INSERT OR IGNORE INTO company(name) VALUES(?)",
                        ("KO(コーヨー)",))
        cid = c.lastrowid or D.one(
            con, "SELECT id FROM company WHERE name=?", ("KO(コーヨー)",))["id"]
        cur = con.execute(
            "INSERT INTO product(company_id, part_no, drawing_no, material,"
            " container_qty_note, frequency_note) VALUES(?,?,?,?,?,?)",
            (cid, gairin["part_no"], gairin["drawing_no"], gairin["material"],
             gairin["container_qty_note"], gairin["frequency_note"]))
        pid = cur.lastrowid
        for spec in (gairin, nairin):
            cur = con.execute(
                "INSERT INTO template(product_id, name, sheet_name,"
                " special_notes, date_label, updated_at) VALUES(?,?,?,?,?,?)",
                (pid, spec["name"], spec["sheet_name"], spec["special_notes"],
                 spec["date_label"], D.now()))
            tid = cur.lastrowid
            for i, ch in enumerate(spec["characteristics"]):
                con.execute(
                    "INSERT INTO characteristic(template_id, sort_order,"
                    " number, name, type, center_value, tolerance, sub_name,"
                    " sub_tolerance, criteria, axis_range)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (tid, i, ch.get("number"), ch["name"], ch["type"],
                     ch.get("center_value") or "", ch.get("tolerance") or "",
                     ch.get("sub_name") or "", ch.get("sub_tolerance") or "",
                     ch.get("criteria") or "", ch.get("axis_range")))
        return {"ok": True, "product_id": pid}
