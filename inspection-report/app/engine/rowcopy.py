"""行単位コピーの基盤。

基準Excelの行範囲を、書式(font/border/fill/alignment/number_format)・
結合セル・行高ごと別シートへ複製する。openpyxl の copy_worksheet は
使わず、同一ワークブック内でセルスタイル(StyleArray)を共有コピーする
ことで書式の再現ずれを構造的に防ぐ。
"""
from copy import copy

MAX_COL = 21  # A..U が有効レイアウト


def copy_row_range(src_ws, src_start, src_end, dst_ws, dst_start,
                   with_values=True, max_col=MAX_COL):
    """src_ws の行 src_start..src_end を dst_ws の dst_start 以降へ複製する。

    戻り値: 複製した行数。
    セル値・スタイル・行高・行範囲内で完結する結合セルをコピーする。
    """
    offset = dst_start - src_start
    for r in range(src_start, src_end + 1):
        src_dim = src_ws.row_dimensions.get(r)
        if src_dim is not None:
            dst_dim = dst_ws.row_dimensions[r + offset]
            dst_dim.height = src_dim.height
            dst_dim.hidden = src_dim.hidden
            dst_dim.outlineLevel = src_dim.outlineLevel
        for c in range(1, max_col + 1):
            sc = src_ws.cell(row=r, column=c)
            dc = dst_ws.cell(row=r + offset, column=c)
            if with_values and sc.value is not None:
                dc.value = sc.value
            if sc.has_style:
                dc._style = copy(sc._style)
    for m in src_ws.merged_cells.ranges:
        if m.min_row >= src_start and m.max_row <= src_end and m.min_col <= max_col:
            dst_ws.merge_cells(start_row=m.min_row + offset, start_column=m.min_col,
                               end_row=m.max_row + offset, end_column=m.max_col)
    return src_end - src_start + 1


def copy_single_row_styles(src_ws, src_row, dst_ws, dst_row, max_col=MAX_COL):
    """1行分のスタイルと行高のみコピー(値・結合なし)。軸の合成用。"""
    src_dim = src_ws.row_dimensions.get(src_row)
    if src_dim is not None:
        dst_ws.row_dimensions[dst_row].height = src_dim.height
    for c in range(1, max_col + 1):
        sc = src_ws.cell(row=src_row, column=c)
        dc = dst_ws.cell(row=dst_row, column=c)
        if sc.has_style:
            dc._style = copy(sc._style)


def copy_sheet_settings(src_ws, dst_ws, max_col=MAX_COL):
    """列幅・印刷設定・シート書式をコピーする。"""
    for key, dim in src_ws.column_dimensions.items():
        nd = dst_ws.column_dimensions[key]
        nd.width = dim.width
        nd.bestFit = dim.bestFit
        nd.hidden = dim.hidden
        nd.min = dim.min
        nd.max = dim.max
    dst_ws.sheet_format = copy(src_ws.sheet_format)
    dst_ws.page_setup = copy(src_ws.page_setup)
    dst_ws.page_margins = copy(src_ws.page_margins)
    dst_ws.print_options = copy(src_ws.print_options)
    dst_ws.sheet_properties.pageSetUpPr = copy(src_ws.sheet_properties.pageSetUpPr)
    dst_ws.sheet_view.showGridLines = src_ws.sheet_view.showGridLines
    dst_ws.sheet_view.zoomScale = src_ws.sheet_view.zoomScale
