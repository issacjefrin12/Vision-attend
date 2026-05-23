@echo off

start cmd /k "cd /d D:\vision_attend\backend && venv\Scripts\activate && uvicorn app.main:app --reload"

start cmd /k "cd /d D:\vision_attend\frontend && npm run dev"