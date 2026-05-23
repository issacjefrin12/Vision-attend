# Vision Attend - Smart Attendance System

Vision Attend is an AI-assisted attendance platform for colleges using FastAPI, React, PostgreSQL, and face recognition.

## Core Roles

- Student
- Faculty
- Admin

No super admin is required in the current scope.

## Role Experience

### Student

- Dashboard with name, register number, department, semester
- Overall attendance card and shortage warning below 75%
- Subject-wise attendance table with progress bars
- Attendance calendar (present/absent/holiday)
- Notifications and profile access

### Faculty

- Dashboard with today classes, total students, present count
- Live attendance entry point with camera workflow
- My classes and reports
- Leave approval page

### Admin

- User management (students/faculty/admin users)
- Department and class setup through course + student screens
- Face data operations through enrollment flow
- Attendance analytics and system settings

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- Backend: FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- AI/ML: MTCNN, face_recognition, OpenCV
- Auth: JWT + password hashing

## Run Locally

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
venv\Scripts\alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Highlights

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/session/start` (entry/hourly session start by faculty/admin)
- `POST /api/session/mark` (student/faculty selfie + code/id)
- `POST /api/session/close` (manual close)
- `GET /api/session/active`
- `PUT /api/session/policy/{department_id}` (admin entry policy)
- `GET /api/timetable`
- `POST /api/timetable`
- `POST /api/leave/apply`
- `GET /api/leave/my-requests`
- `GET /api/leave/pending`
- `PUT /api/leave/{id}/approve`
- `PUT /api/leave/{id}/reject`
- `GET /api/notifications/my`
- `GET /api/unknown-faces/today-count`

## Migrations (Alembic)

```bash
cd backend
venv\Scripts\alembic revision --autogenerate -m "describe change"
venv\Scripts\alembic upgrade head
```

## Deployment

- Production deployment guide: [DEPLOY.md](DEPLOY.md)
- Includes LAN access, VPS setup flow, and update workflow using:
  - `git pull`
  - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
