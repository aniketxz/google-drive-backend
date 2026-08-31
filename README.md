# Google Drive Backend

Enterprise-grade Node.js + TypeScript backend with Google OAuth, S3 multipart uploads, PostgreSQL, and Redis sessions.

**Stack**: Express · TypeScript · Drizzle ORM · PostgreSQL · Redis · AWS S3 · Docker · Caddy

---

## Quick Links

Backend Repo: https://github.com/aniketxz/google-drive-backend

Frontend Repo: https://github.com/aniketxz/google-drive-frontend

Live Link: https://google-drive.aniketxz.dev

---

## Features implemented

### 1. Authentication:
- Google OAuth for authentication
- Session management using redis

### 2. File Management:
- Upload, Delete, Rename, Star, Search, Trash
- Multi-part upload of files (files greater than 10MB)

### 3. File Storage:
- Using Amazon S3 (presigned URLs)

### 4. Sharing & Public Links:
- User-to-user sharing by email with permission levels (`view` / `edit`) and expiration support
- Dedicated "Shared with Me" and "Shared by Me" views
- Token-based unauthenticated public links with expiration support
- Automatic background cleanup of expired shares and links

---

## Quickstart

```bash
# Clone and install dependencies
git clone https://github.com/your-username/google-drive-backend.git
cd google-drive-backend
npm install

# Setup environment variables
cp .env.example .env

# Start services & run migrations
docker compose up db redis -d
npm run db:migrate

# Start development server
npm run dev
```

The server starts at `http://localhost:3000`.  
Health check: `GET http://localhost:3000/health`

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default `3000`) |
| `CLIENT_URL` | Frontend origin for CORS |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Token secret (min 32 chars) |
| `JWT_EXPIRY` | Token TTL (e.g. `7d`) |
| `SESSION_TTL_SECONDS` | Redis session TTL (default `604800`) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI |
| `AWS_REGION` | S3 bucket region |
| `AWS_ACCESS_KEY_ID` | AWS Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key |
| `AWS_S3_BUCKET` | S3 Bucket name |
| `PRESIGNED_URL_EXPIRES` | Presigned download URL TTL in seconds |
| `MAX_FILE_SIZE_BYTES` | Max file upload limit |
| `MULTIPART_CHUNK_SIZE_BYTES` | Upload chunk size |
| `DEFAULT_USER_QUOTA_BYTES` | User storage quota |

---

## Database Commands

```bash
npm run db:generate   # Generate new migration from schema
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Launch Drizzle Studio DB viewer
```

---

## Deployment

### 1. Server Setup & Cloning
1. Provision an Ubuntu EC2 instance (`t3.small`+), allocate an Elastic IP, and point your DNS domain to it.
2. Ensure inbound rules for ports `80`, `443`, and `22` are open.
3. SSH into instance and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   ```
4. Clone repo and create production `.env`:
   ```bash
   git clone https://github.com/your-username/google-drive-backend.git
   cd google-drive-backend
   cp .env.example .env
   ```

### 2. Configure Caddy & Start Services
Update `Caddyfile` with your domain:
```caddy
api.yourdomain.com {
    reverse_proxy api:3000
}
```

Build and launch containers:
```bash
docker compose up -d --build
```

### 3. Redeploying Updates
```bash
bash scripts/deploy.sh
```

---

## Useful Commands

```bash
# Docker Logs & Status
docker compose ps
docker compose logs -f api

# Container Management
docker compose restart api
docker compose down

# Database Management
docker compose exec db psql -U postgres -d gdrive_db
docker compose exec db pg_dump -U postgres gdrive_db > backup.sql
```

---

## Documentation & Roadmap
 
 - **API Documentation**: See [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md) for full endpoint reference.
 - **Frontend Sharing Guide**: See [`FRONTEND-SHARING-GUIDE.md`](./FRONTEND-SHARING-GUIDE.md) for frontend integration instructions for Shares & Public Links.
 - **Future Roadmap**: See [`backend-plan.md`](./backend-plan.md) for Phase 6 (RabbitMQ Worker for thumbnail generation).
