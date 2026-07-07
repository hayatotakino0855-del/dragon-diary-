"""SQLite データアクセス層。

DBファイルは data/app.db。スキーマは起動時に自動作成する。
数値入力・合否判定は将来拡張のためスコープ外だが、データモデルは
特性定義を壊さない形で保持する。
"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.environ.get("INSPECTION_DB",
                         os.path.join(DATA_DIR, "app.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    part_no TEXT NOT NULL,
    drawing_no TEXT DEFAULT '',
    material TEXT DEFAULT '',
    container_qty_note TEXT DEFAULT '',
    frequency_note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sheet_name TEXT DEFAULT '',
    special_notes TEXT DEFAULT '',
    date_label TEXT DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0,
    author TEXT DEFAULT '',
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS characteristic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES template(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    number INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    center_value TEXT DEFAULT '',
    tolerance TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    sub_name TEXT DEFAULT '',
    sub_tolerance TEXT DEFAULT '',
    criteria TEXT DEFAULT '',
    axis_step REAL,
    axis_range REAL
);
CREATE TABLE IF NOT EXISTS char_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    center_value TEXT DEFAULT '',
    tolerance TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    sub_name TEXT DEFAULT '',
    sub_tolerance TEXT DEFAULT '',
    criteria TEXT DEFAULT ''
);
"""


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    with connect() as con:
        con.executescript(SCHEMA)


@contextmanager
def db():
    con = connect()
    try:
        yield con
        con.commit()
    finally:
        con.close()


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def rows(con, sql, args=()):
    return [dict(r) for r in con.execute(sql, args).fetchall()]


def one(con, sql, args=()):
    r = con.execute(sql, args).fetchone()
    return dict(r) if r else None
