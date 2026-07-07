"""CLI: JSON テンプレート定義から帳票 Excel を生成する。

使い方:
    python -m app.engine.cli samples/ko5155b.json out.xlsx
JSON はテンプレート定義の配列(1定義=1シート)または単一定義。
"""
import json
import sys

from .generator import auto_shrink, fit_report, generate_workbook


def main(argv=None):
    argv = argv or sys.argv[1:]
    if len(argv) < 2:
        print(__doc__)
        return 1
    src, dst = argv[0], argv[1]
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    templates = data if isinstance(data, list) else [data]

    for t in templates:
        for rep in fit_report([t]):
            if not rep["fits"]:
                if auto_shrink(t):
                    print(f"[warn] {rep['name']}: 1ページ超過のため軸延長範囲を自動短縮しました")
                rep2 = fit_report([t])[0]
                if not rep2["fits"]:
                    print(f"[warn] {rep['name']}: 自動短縮でも1ページに収まりません "
                          f"(高さ {rep2['height']} / 上限 {rep2['budget']})。項目削減を検討してください")

    wb = generate_workbook(templates)
    wb.save(dst)
    print(f"generated: {dst} ({len(templates)} sheet(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
