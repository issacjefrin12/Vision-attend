# Vision Attend Deployment Guide

This guide sets up Vision Attend so you can:
- access it from other devices
- keep making code changes and redeploy quickly

## 1) Prerequisites

- A machine that stays on (your PC for LAN, or a VPS for internet access)
- Docker + Docker Compose installed
- Ports open on host/firewall:
  - `80` (frontend)

## 2) First-time setup

From the project root:

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod`:
- set strong `POSTGRES_PASSWORD`
- set strong `SECRET_KEY`
- set correct `ALLOWED_ORIGINS` and `FRONTEND_URL`

## 3) Run in production mode

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
```

The app will be available at:
- `http://<server-ip>:<FRONTEND_PORT>`

## 4) Access from other devices

### Same Wi-Fi / LAN
- Find server IP (example `192.168.1.20`)
- Open `http://192.168.1.20` from another device
- In `.env.prod`, set:
  - `FRONTEND_URL=http://192.168.1.20`
  - `ALLOWED_ORIGINS=http://192.168.1.20`
- Recreate:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### Internet (public)
- Deploy on VPS
- Point domain DNS to VPS IP
- Put Nginx/Caddy in front for HTTPS (recommended)
- Then set:
  - `FRONTEND_URL=https://your-domain.com`
  - `ALLOWED_ORIGINS=https://your-domain.com`

## 5) Future code updates (your main ask)

After you change code and push to git:

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

That command rebuilds changed services and keeps volumes/data.

## 6) Backup and restore

Important Docker volumes:
- `postgres_data` (database)
- `face_encodings` (face encodings)
- `unknown_faces` (captured unknown face images)

At minimum, back up `postgres_data` regularly.

## 7) Helpful commands

Stop:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Restart:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
```

Run migration manually:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend alembic upgrade head
```
