@echo off
rem DB日次バックアップ(タスクスケジューラに登録して使用)
cd /d "%~dp0.."
python scripts\backup_db.py
