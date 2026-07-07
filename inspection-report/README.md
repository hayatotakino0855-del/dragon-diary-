# 検査日報レイアウト自動生成ツール

ライン作業検査日報(手書き記入用の空欄帳票)を、特性(項目名・中心値・公差)を
登録するだけで自動レイアウト生成し、Excelとして出力する社内Webアプリ。

- 出力様式は基準Excel(`reference/KO-5155B-HT__6212RSH2_SET_.xlsx`)と同一。
  基準のブロック雛形を書式・結合・行高ごと複製し、値だけ差し替える方式のため
  罫線・フォントの再現ずれが構造的に起きない。
- 数値の入力・記録機能はスコープ外(印刷して現場で手書き記入する運用)。
- 内輪・外輪は別シート。各シートはA4縦・実寸で印刷1枚に収まる。

## セットアップ

```bash
pip install -r requirements.txt
```

## 起動(サーバー役PC)

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows は `scripts\run.bat` をダブルクリックでも可。
各PCのブラウザから `http://<サーバーPCのIP>:8000/` にアクセスする。
認証なし(社内LAN前提)。

初回は一覧画面の「サンプルデータ投入」で基準Excel相当のデータ
(KO-5155B-HT / 6212RSH2 SET の外輪・内輪)が登録できる。

## 画面

| 画面 | 内容 |
|---|---|
| 一覧 `/` | 会社 → 品番 → テンプレートのツリー表示。フィルター(会社・品番・図番・テンプレート名・キーワード)。行アクション: 編集 / 複製 / 改訂 / Excel出力 / 削除 |
| テンプレート編集 `/templates/{id}/edit` | ヘッダ情報・特記事項・特性リスト(追加・削除・並べ替え・特性マスタ呼び出し)。プレビュー(LibreOfficeがあればPDF、無ければHTML簡易表示) |
| マスタ管理 `/masters` | 会社マスタ、特性マスタ(よく使う特性定義の登録) |

## 特性タイプ

| type | 例 | 軸 |
|---|---|---|
| `bilateral` | A面外径 84.3 ±0.3 | 上下対称軸(+0.1/0/-0.1 を中心に展開)。中心値を空にすると名称のみの変形(破断径欄) |
| `bilateral_with_sub` | 総幅 22.8±0.3 + 幅不同 0.3以下 | 同上+左ラベル4段 |
| `unilateral` | 溝偏肉 0.8 以下 | 0起点の片側軸 |
| `weight` | 重量 445.0 gr ±4.0 gr | 5..0..5 固定軸・上下余白帯 |
| `visual` | 外観 有害な欠陥無き事 | ○×記入用1行 |
| `measured` | ツバ幅 | 実測値記入欄(内輪の先頭ブロック) |

軸延長範囲(axis_range)・刻み(axis_step)は空欄で基準様式と同一。
1ページに収まらない場合は保存時に警告が出て、「軸を自動短縮して収める」で
軸延長範囲を段階的に短縮できる(自動で2枚分割はしない)。

## 出力

- 一覧・編集画面の「Excel出力」ボタンで `.xlsx` ダウンロード。
  品番単位の出力では「内輪+外輪を1ブック複数シート」も選択可。
- ファイル名: `{図番}_{品番}_{テンプレート名}_{YYYYMMDD}.xlsx`

## CLI(エンジン単体)

```bash
python samples/make_samples.py            # 基準Excelから定義JSONを抽出
python -m app.engine.cli samples/ko5155b.json out.xlsx
```

## テスト

```bash
python -m pytest tests/
```

受け入れテスト(`tests/test_regenerate.py`)は基準Excelと同じ特性定義から
外輪・内輪を再生成し、セル値・結合・列幅・行高・実効罫線・フォント・配置・
表示形式の一致を検証する。

## 運用

- DB: `data/app.db`(SQLite)。`scripts/backup_db.py`(Windowsは
  `scripts\backup.bat`)を日次実行すると `data/backup/` に30世代保存。
- 図面改訂: 一覧の「改訂」ボタンで複製すると旧版はアーカイブ(旧版バッジ付き)
  として残り、改訂番号が+1される。「旧改訂も表示」で確認できる。

## 構成

```
app/
  engine/         帳票生成エンジン(基準Excel雛形の行単位複製)
    prototypes.py 基準Excel内のブロック雛形定義(行範囲・差し替え位置)
    rowcopy.py    行範囲コピー(書式・結合・行高)
    axis.py       目盛りラベル生成
    generator.py  シート組み立て・1ページ判定・軸自動短縮
    cli.py        CLI
  main.py         FastAPI(画面+API)
  db.py           SQLite
  service.py      DB→エンジン定義変換・出力
  preview_html.py HTML簡易プレビュー
reference/        基準Excel(様式の正)
samples/          基準Excel相当の定義JSON抽出
tests/            受け入れテスト・APIテスト
scripts/          起動bat・バックアップ
```
