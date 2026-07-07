"""SQLite DBの簡易バックアップ。日次実行を想定(タスクスケジューラ等)。

data/app.db を data/backup/app_YYYYMMDD.db にコピーし、30世代を超えた
古いバックアップを削除する。
"""
import glob
import os
import shutil
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "data", "app.db")
DST_DIR = os.path.join(BASE, "data", "backup")
KEEP = 30


def main():
    if not os.path.exists(SRC):
        print("DBファイルがありません:", SRC)
        return
    os.makedirs(DST_DIR, exist_ok=True)
    dst = os.path.join(DST_DIR, f"app_{date.today():%Y%m%d}.db")
    shutil.copy2(SRC, dst)
    print("backup:", dst)
    backups = sorted(glob.glob(os.path.join(DST_DIR, "app_*.db")))
    for old in backups[:-KEEP]:
        os.remove(old)
        print("removed:", old)


if __name__ == "__main__":
    main()
