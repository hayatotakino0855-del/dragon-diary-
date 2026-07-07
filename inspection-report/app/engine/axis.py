"""目盛り軸ラベルの生成ロジック。

基準Excelの表記ルール:
- 中心値の直上下のみ符号付き(+0.1 / 0 / -0.1)、それ以外は絶対値表示
- 公差の内側は step 刻み、公差境界の外側へ axis_range まで延長
"""
from decimal import Decimal


def _fmt(value, step):
    d = Decimal(str(step)).normalize()
    decimals = max(0, -d.as_tuple().exponent)
    return f"{value:.{decimals}f}"


def bilateral_labels(axis_range, step):
    """対称軸。上から [R .. 2s] + [+s, 0, -s] + [2s .. R]。

    戻り値: (upper, center3, lower) のタプル(いずれも文字列リスト)。
    """
    r = Decimal(str(axis_range))
    s = Decimal(str(step))
    n = int(r / s)  # 総目盛り数(片側) = n、うち内側1つは符号付き
    upper = [_fmt(s * i, s) for i in range(n, 1, -1)]
    center = [f"+{_fmt(s, s)}", "0", f"-{_fmt(s, s)}"]
    lower = [_fmt(s * i, s) for i in range(2, n + 1)]
    return upper, center, lower


def unilateral_labels(axis_range, step):
    """0起点の片側軸。上から [R, R-s, ..., s, 0]。"""
    r = Decimal(str(axis_range))
    s = Decimal(str(step))
    n = int(r / s)
    labels = [_fmt(s * i, s) for i in range(n, 0, -1)]
    labels.append("0")
    return labels
