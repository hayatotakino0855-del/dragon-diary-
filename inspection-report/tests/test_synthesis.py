"""軸延長範囲を変えた場合(雛形と異なる軸)のブロック合成テスト。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.engine.generator import auto_shrink, fit_report, generate_workbook  # noqa: E402


def _tmpl(chars):
    return dict(name="外輪", ring_type="外輪", part_no="TEST", material="SUJ2",
                drawing_no="TEST-1", container_qty_note="3000個未満",
                frequency_note="n=2/容器", special_notes="特記事項",
                characteristics=chars)


def test_bilateral_short_axis():
    t = _tmpl([dict(type="bilateral", name="外径", center_value="84.3",
                    tolerance="0.3", axis_range=0.8)])
    wb = generate_workbook([t])
    ws = wb["外輪"]
    labels = [ws.cell(row=r, column=4).value
              for r in range(13, 13 + 34) if ws.cell(row=r, column=4).value]
    assert labels == ["0.8", "0.7", "0.6", "0.5", "0.4", "0.3", "0.2",
                      "+0.1", "0", "-0.1",
                      "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8"]
    # ブロック行数 = 2(余白) + 2×17(目盛り)
    merges = {str(m) for m in ws.merged_cells.ranges}
    assert "A13:A48" in merges          # 特性番号の縦結合
    assert "B13:C27" in merges          # 名称
    assert "B28:C32" in merges          # 中心値
    assert "B33:C48" in merges          # 公差
    assert ws["B28"].value == 84.3
    assert ws["B33"].value == "±0.3"


def test_unilateral_short_axis():
    t = _tmpl([dict(type="unilateral", name="溝偏肉", center_value="0.5",
                    tolerance="0.5", axis_range=0.6)])
    wb = generate_workbook([t])
    ws = wb["外輪"]
    labels = [ws.cell(row=r, column=4).value
              for r in range(13, 13 + 15) if ws.cell(row=r, column=4).value]
    assert labels == ["0.6", "0.5", "0.4", "0.3", "0.2", "0.1", "0"]
    assert ws["B13"].value == "溝偏肉"


def test_fit_report_and_auto_shrink():
    # 基準と同じ8特性は1ページに収まる
    from samples.make_samples import build
    reps = fit_report(build())
    assert all(r["fits"] for r in reps)

    # 特性を大量に積むと収まらない → 自動短縮が軸を縮める
    big = _tmpl([dict(type="bilateral", name=f"特性{i}", center_value="10.0",
                      tolerance="0.3", axis_range=1.0) for i in range(9)])
    assert not fit_report([big])[0]["fits"]
    auto_shrink(big)
    ranges = [c["axis_range"] for c in big["characteristics"]]
    assert any(r < 1.0 for r in ranges)
