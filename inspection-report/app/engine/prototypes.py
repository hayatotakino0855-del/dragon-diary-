"""基準Excelのブロック雛形(プロトタイプ)定義。

出力の正解は基準Excelそのもの。各特性タイプの雛形として基準Excel内の
行範囲を参照し、生成時はこの範囲を書式ごと複製して値だけ差し替える。

行オフセットはすべてブロック先頭行からの 0 始まり相対値。
"""
import os

REFERENCE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "reference", "KO-5155B-HT__6212RSH2_SET_.xlsx")

SHEET_GAIRIN = "外輪"
SHEET_NAIRIN = "内輪 (ツバ幅　なし)"

# ---- ヘッダ・フッタ雛形(外輪シートから) ----
HEADER = dict(sheet=SHEET_GAIRIN, start=1, end=12)
FOOTER = dict(sheet=SHEET_GAIRIN, start=334, end=341)

# ヘッダ内の差し替えセル(行, 列)と組み立て書式
HEADER_FIELDS = dict(
    ring_type=(4, 2),        # B4  輪種別(外輪/内輪)
    part_no=(6, 3),          # C6  品番
    material=(6, 10),        # J6  材質・径
    drawing_no=(7, 3),       # C7  図番:XXXX
    container_qty=(3, 10),   # J3  容器入個数 : XXXX
    frequency=(11, 2),       # B11 頻 度 XXXX
    date_label=(4, 11),      # K4  20 年 月 日
)
DRAWING_NO_PREFIX = "図番："
CONTAINER_QTY_PREFIX = "容器入個数　：　"
FREQUENCY_PREFIX = "頻　度　"
DEFAULT_DATE_LABEL = "20　　　　　年　　　月　　　日"
FOOTER_NOTES_CELL = (337, 1)  # A337 特記事項(結合 A:T ×5行)

# ---- 特性ブロック雛形 ----
# tick_* オフセットは目盛りペア(2行)の先頭行。
BLOCKS = {
    # 両側公差(A面外径 84.3±0.3、軸 1.0..0..1.0)。外輪 65..108
    "bilateral": dict(
        sheet=SHEET_GAIRIN, start=65, end=108,
        axis_range=1.0, axis_step=0.1,
        pad_top=0, pad_bottom=43,
        upper_ticks=[1 + 2 * i for i in range(9)],    # 外側→内側
        center_ticks=[19, 21, 23],                     # +0.1 / 0 / -0.1
        lower_ticks=[25 + 2 * i for i in range(9)],   # 内側→外側
        name_cell=0, center_cell=19, tol_cell=24,
        # B:C 縦結合: 名称 = 先頭..(+0.1行-1) / 中心値5行 / 公差=残り
        sections=lambda start, c, end: [(start, c - 1), (c, c + 4), (c + 5, end)],
    ),
    # 両側公差・値なし変形(B面内径(破断径)。名称のみ中央に1セル)。外輪 197..240
    "bilateral_plain": dict(
        sheet=SHEET_GAIRIN, start=197, end=240,
        axis_range=1.0, axis_step=0.1,
        pad_top=0, pad_bottom=43,
        upper_ticks=[1 + 2 * i for i in range(9)],
        center_ticks=[19, 21, 23],
        lower_ticks=[25 + 2 * i for i in range(9)],
        name_cell=20,  # B217 = '0'目盛りペアの直前行。結合なし
        center_cell=None, tol_cell=None,
        sections=None,
    ),
    # 両側公差+サブ規格(総幅 22.8±0.3 / 幅不同 0.3以下、軸 1.2..0..1.2)。外輪 13..64
    "bilateral_with_sub": dict(
        sheet=SHEET_GAIRIN, start=13, end=64,
        axis_range=1.2, axis_step=0.1,
        pad_top=0, pad_bottom=51,
        upper_ticks=[1 + 2 * i for i in range(11)],
        center_ticks=[23, 25, 27],
        lower_ticks=[29 + 2 * i for i in range(11)],
        name_cell=0, center_cell=22, sub_name_cell=26, sub_tol_cell=30,
        # 名称 / 中心値±公差(4行) / サブ名称(4行) / サブ規格=残り
        sections=lambda start, c, end: [(start, c - 2), (c - 1, c + 2),
                                        (c + 3, c + 6), (c + 7, end)],
    ),
    # 片側公差(溝偏肉 0.8以下、軸 1.0..0)。外輪 241..263
    "unilateral": dict(
        sheet=SHEET_GAIRIN, start=241, end=263,
        axis_range=1.0, axis_step=0.1,
        pad_top=0, pad_bottom=None,
        ticks=[1 + 2 * i for i in range(11)],
        name_cell=0, center_cell=9, tol_cell=19,
        # 名称9行 / 数値10行 / 「以下」4行(23行中)
        section_fracs=(9 / 23, 10 / 23),
    ),
    # 重量(軸は 5..0..5 固定・上下に余白帯)。外輪 287..331
    "weight": dict(
        sheet=SHEET_GAIRIN, start=287, end=331,
        name_cell=0, center_cell=17, tol_cell=24,
    ),
    # 外観(○×記入欄)。外輪 332..333
    "visual": dict(
        sheet=SHEET_GAIRIN, start=332, end=333,
        name_cell=0, criteria_cell=1,
    ),
    # 実測値記入(ツバ幅)。内輪 13..23
    "measured": dict(
        sheet=SHEET_NAIRIN, start=13, end=23,
        name_cell=0,
    ),
}
