"""DBのテンプレート/特性 → 生成エンジンのテンプレート定義への変換と出力。"""
from datetime import date

from . import db as D
from .engine.generator import fit_report, generate_workbook


def load_template_spec(con, template_id):
    t = D.one(con, "SELECT * FROM template WHERE id=?", (template_id,))
    if not t:
        return None
    p = D.one(con, "SELECT * FROM product WHERE id=?", (t["product_id"],))
    chars = D.rows(con, "SELECT * FROM characteristic WHERE template_id=? "
                        "ORDER BY sort_order, id", (template_id,))
    spec = dict(
        name=t["name"],
        sheet_name=t["sheet_name"] or t["name"],
        ring_type=t["name"],
        part_no=p["part_no"],
        drawing_no=p["drawing_no"],
        material=p["material"],
        container_qty_note=p["container_qty_note"],
        frequency_note=p["frequency_note"],
        date_label=t["date_label"] or None,
        special_notes=t["special_notes"],
        characteristics=[_char_to_spec(c) for c in chars],
    )
    return spec, t, p


def _char_to_spec(c):
    return dict(
        number=c["number"],
        type=c["type"],
        name=c["name"],
        center_value=c["center_value"] or None,
        tolerance=c["tolerance"] or None,
        unit=c["unit"] or None,
        sub_name=c["sub_name"] or None,
        sub_tolerance=c["sub_tolerance"] or None,
        criteria=c["criteria"] or None,
        axis_step=c["axis_step"],
        axis_range=c["axis_range"],
    )


def export_filename(product, template_names):
    name = "+".join(template_names)
    stamp = date.today().strftime("%Y%m%d")
    raw = f"{product['drawing_no']}_{product['part_no']}_{name}_{stamp}.xlsx"
    return "".join(ch for ch in raw if ch not in '\\/:*?"<>|')


def generate_for_templates(con, template_ids):
    """テンプレートID群から (workbook, ファイル名, 警告リスト) を返す。"""
    specs, names, product = [], [], None
    for tid in template_ids:
        loaded = load_template_spec(con, tid)
        if not loaded:
            raise KeyError(f"template {tid} not found")
        spec, t, p = loaded
        specs.append(spec)
        names.append(t["name"])
        product = product or p
    warnings = [f"「{r['name']}」は1ページに収まりません"
                f"(高さ {r['height']} / 上限 {r['budget']})。"
                "軸延長範囲の短縮か項目削減を検討してください。"
                for r in fit_report(specs) if not r["fits"]]
    wb = generate_workbook(specs)
    return wb, export_filename(product, names), warnings
