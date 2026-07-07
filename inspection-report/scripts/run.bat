@echo off
rem 検査日報レイアウト自動生成ツール 起動用(Windows / サーバー役PC)
cd /d "%~dp0.."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
