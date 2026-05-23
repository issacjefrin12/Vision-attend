# Vision Attend

Vision Attend is a vision-based attendance tracking system for colleges, with role-based dashboards for students, faculty, and admins.

## What This Project Includes

- Face-assisted attendance marking workflow
- Session-based attendance (start, mark, close)
- Student, faculty, and admin role access
- Timetable, leave requests, notifications, and analytics
- FastAPI backend + React frontend + PostgreSQL database

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- ML/CV: MTCNN, `face_recognition`, OpenCV
- Auth: JWT

## Repository Access

- Public repo: anyone with the link can view and clone
- Private repo: only invited collaborators can access

Repository URL:

`https://github.com/issacjefrin12/Vision-attend`

## Quick Start (Docker Recommended)

### 1) Clone

```bash
git clone https://github.com/issacjefrin12/Vision-attend.git
cd Vision-attend
```

### 2) Start all services

```bash
docker compose up -d --build
```

This starts:

- Frontend: `http://localhost`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

### 3) Stop services

```bash
docker compose down
```

## Local Development (Without Docker)

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+

### Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
venv\Scripts\alembic upgrade head
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Default Login (Development)

On startup, backend seeds a default admin user:

- Email: `admin@visionattend.com`
- Password: `admin123`

Change this immediately for production use.

## Environment Files

- Backend template: `backend/.env.example`
- Frontend template: `frontend/.env.example`

Never commit real secrets. Keep real values only in local `.env` files.

## API Highlights

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/session/start`
- `POST /api/session/mark`
- `POST /api/session/close`
- `GET /api/session/active`
- `PUT /api/session/policy/{department_id}`
- `POST /api/leave/apply`
- `GET /api/leave/pending`
- `GET /api/notifications/my`

## Deployment

- Production deployment guide: [DEPLOY.md](DEPLOY.md)
- Includes LAN access, VPS setup flow, and update workflow using:
  - `git pull`
  - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

## Typical Git Workflow

```bash
git add .
git commit -m "your message"
git push
```
## Screenshots of Vision Attend

<img width="1918" height="1027" alt="Screenshot 2026-03-16 223552" src="https://github.com/user-attachments/assets/eb3fe847-1081-4023-b18d-4ad4f90c3af2" />
<img width="1919" height="1029" alt="Screenshot 2026-03-16 223906" src="https://github.com/user-attachments/assets/a7704447-b658-4d75-9b9b-4dd10a4a16ad" />
