# Google Drive Backend

Enterprise-grade Node.js + TypeScript backend with Google OAuth, S3 multipart uploads, PostgreSQL, and Redis sessions.

**Stack**: Express · TypeScript · Drizzle ORM · PostgreSQL · Redis · AWS S3 · Docker · Caddy

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Environment Variables](#2-environment-variables)
3. [Database Migrations](#3-database-migrations)
4. [Deployment — EC2 Setup](#4-deployment--ec2-setup)
5. [Deployment — Project Setup on EC2](#5-deployment--project-setup-on-ec2)
6. [Deployment — Nginx + SSL](#6-deployment--nginx--ssl)
7. [Deployment — Running the App](#7-deployment--running-the-app)
8. [Redeploying After Changes](#8-redeploying-after-changes)
9. [Useful Commands](#9-useful-commands)
10. [Future Phases](#10-future-phases)

---

## 1. Local Development

**Prerequisites**: Node.js 20+, Docker Desktop

```bash
# Clone the repo
git clone https://github.com/your-username/google-drive-backend.git
cd google-drive-backend

# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Start PostgreSQL + Redis with Docker
docker compose up db redis -d

# Run migrations
npm run db:migrate

# Start the dev server (hot reload)
npm run dev
```

The server starts at `http://localhost:3000`.  
Health check: `GET http://localhost:3000/health`

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in every value.

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default `3000`) |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `https://yourapp.com`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Min 32 chars — generate with `openssl rand -hex 32` |
| `JWT_EXPIRY` | Token TTL, e.g. `7d` |
| `SESSION_TTL_SECONDS` | Redis session TTL (default `604800` = 7 days) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Must match authorized redirect URI in Google Console |
| `AWS_REGION` | S3 bucket region, e.g. `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM user key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_S3_BUCKET` | Bucket name (keep private — files served via presigned URLs) |
| `PRESIGNED_URL_EXPIRES` | Download URL TTL in seconds (default `900` = 15 min) |
| `MAX_FILE_SIZE_BYTES` | Max file size (default `1073741824` = 1 GB) |
| `MULTIPART_CHUNK_SIZE_BYTES` | Upload chunk size (default `10485760` = 10 MB) |
| `DEFAULT_USER_QUOTA_BYTES` | Per-user storage quota (default `2147483648` = 2 GB) |

**Production `DATABASE_URL` format** (Docker Compose service name `db`):
```
DATABASE_URL=postgresql://postgres:yourpassword@db:5432/gdrive_db
```

**Production `REDIS_URL`** (Docker Compose service name `redis`):
```
REDIS_URL=redis://redis:6379
```

---

## 3. Database Migrations

```bash
# Generate a new migration (after schema changes)
npm run db:generate

# Apply all pending migrations
npm run db:migrate

# Open Drizzle Studio (visual DB browser)
npm run db:studio
```

---

## 4. Deployment — EC2 Setup

### Step 1 — Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. **Name**: `gdrive-backend`
3. **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
4. **Instance type**: `t3.small` (2 GB RAM — recommended) or `t3.medium` (4 GB)
5. **Key pair**: Create new → download `.pem` → save it somewhere safe (you cannot recover it)
6. **Network settings**: Click "Edit"
   - Allow SSH from **My IP** only
   - Allow HTTP (port 80) from **Anywhere**
   - Allow HTTPS (port 443) from **Anywhere**
   - **Do not** add rules for port 3000, 5432, or 6379
7. **Storage**: 20 GB gp3
8. Click **Launch Instance**

### Step 2 — Allocate an Elastic IP (Stable Public IP)

> Without this, your server's public IP changes every restart.

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP address** → Allocate
2. Select the new IP → **Actions → Associate Elastic IP address**
3. Select your instance → Associate

### Step 3 — Point Your Domain to the Elastic IP

In your DNS provider (Namecheap, Cloudflare, etc.):

```
Type: A
Name: api          (or @ for root domain)
Value: <your Elastic IP>
TTL:  300
```

Wait 5–15 minutes for DNS to propagate. Test with:
```bash
nslookup api.yourdomain.com
```

### Step 4 — SSH into the Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<your-elastic-ip>
```

---

## 5. Deployment — Project Setup on EC2

Run all of these commands **inside the EC2 instance** via SSH.

### Step 1 — Install Docker

```bash
# Update packages
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add ubuntu user to docker group (so you don't need sudo for docker commands)
sudo usermod -aG docker ubuntu

# Log out and back in for the group change to take effect
exit
```

SSH back in, then verify:
```bash
docker --version
docker compose version
```
### Step 2 — Clone the Repository

```bash
# Clone your repo
git clone https://github.com/your-username/google-drive-backend.git
cd google-drive-backend
```

### Step 3 — Create the Production `.env` File

```bash
cp .env.example .env
nano .env
```

Fill in every value. Critical production values:

```bash
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-frontend-domain.com

DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@db:5432/gdrive_db
REDIS_URL=redis://redis:6379

JWT_SECRET=<run: openssl rand -hex 32>
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback

# AWS and Google credentials...
```

> **Update Google Cloud Console**: Go to your OAuth 2.0 Client → Authorized redirect URIs → Add `https://api.yourdomain.com/auth/google/callback`

Save and exit (`Ctrl+X`, `Y`, `Enter`).

### Step 4 — Run Database Migrations

Start only the database first to run migrations against it:

```bash
# Start PostgreSQL container only
docker compose up db -d

# Wait for it to be healthy, then run migrations
sleep 10
docker compose run --rm api sh -c "node -e \"
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { migrate } = require('drizzle-orm/node-postgres/migrator');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  migrate(db, { migrationsFolder: './src/db/migrations' })
    .then(() => { console.log('Done'); pool.end(); })
    .catch(e => { console.error(e); process.exit(1); });
\""
```

> **Alternative**: Run `npm run db:migrate` locally with `DATABASE_URL` pointing at the EC2 PostgreSQL port temporarily (not recommended for production — migrations should run server-side).

---

## 6. Deployment — Caddy Configuration

Caddy runs inside Docker as a container service alongside the API, database, and Redis. It handles reverse proxying and automatically obtains/renews SSL certificates from Let's Encrypt for your domain.

### Step 1 — Edit Caddyfile

Edit the `Caddyfile` in the project root on the EC2 instance:

```bash
nano Caddyfile
```

Replace `api.yourdomain.com` with your actual domain:

```caddy
api.yourdomain.com {
    reverse_proxy api:3000
}
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

---

## 7. Deployment — Running the App

### Step 1 — Build and Start All Containers

```bash
cd ~/google-drive-backend

# Build the production Docker image and start all services
docker compose up -d --build

# Watch the logs to confirm startup
docker compose logs -f api
```

Expected output:
```
api  | {"level":"info","msg":"Redis connected"}
api  | {"level":"info","msg":"Database connected"}
api  | {"level":"info","msg":"Server running on port 3000 [production]"}
```

### Step 2 — Verify the Health Endpoint

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-28T00:00:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Step 3 — Test Google OAuth

1. Open `https://api.yourdomain.com/auth/google` in a browser
2. Complete the Google consent screen
3. You should be redirected to your `CLIENT_URL` with the `gdrive_token` cookie set
4. Call `GET https://api.yourdomain.com/auth/me` — you should get your user profile

---

## 8. Redeploying After Changes

After pushing new code to GitHub, SSH into the EC2 instance and run:

```bash
cd ~/google-drive-backend
bash scripts/deploy.sh
```

This script:
1. Pulls latest code (`git pull`)
2. Rebuilds the Docker image (`--no-cache`)
3. Runs any new migrations
4. Restarts containers
5. Runs a health check to confirm success

---

## 9. Useful Commands

### Container management
```bash
# View running containers
docker compose ps

# View API logs (live)
docker compose logs -f api

# View last 100 lines of logs
docker compose logs api --tail=100

# Restart a single service
docker compose restart api

# Stop everything
docker compose down

# Stop + delete volumes (WARNING: deletes all database data)
docker compose down -v
```

### Database
```bash
# Open a psql shell in the database container
docker compose exec db psql -U postgres -d gdrive_db

# Run a one-off SQL query
docker compose exec db psql -U postgres -d gdrive_db -c "SELECT COUNT(*) FROM users;"

# Backup the database
docker compose exec db pg_dump -U postgres gdrive_db > backup.sql

# Restore from backup
docker compose exec -T db psql -U postgres -d gdrive_db < backup.sql
```

### Caddy
```bash
# Check Caddy logs (including certificate issues)
docker compose logs -f caddy

# Reload Caddy config (no downtime)
docker compose exec -w /etc/caddy caddy caddy reload
```

### Instance monitoring
```bash
# Check memory usage
free -h

# Check disk usage
df -h

# Check CPU/memory per process
top

# Check Docker container resource usage
docker stats
```

---

## 10. Future Phases

### Phase 6 — Thumbnail Worker (RabbitMQ)

To enable async thumbnail generation:

1. **`src/server.ts`** — uncomment `connectRabbitMQ()` and `closeRabbitMQ()`
2. **`src/app.ts`** — uncomment `isRabbitMQHealthy()` import and health check line
3. **`docker-compose.yml`** — uncomment `rabbitmq`, `worker`, and `rabbitmqdata` volume sections
4. Create `src/queue/publishers/thumbnail.publisher.ts`
5. Create `src/queue/consumers/thumbnail.consumer.ts`
6. Create `src/jobs/stale-uploads.job.ts`
7. Call `registerEventListeners(thumbnailPublisher)` at startup

See the **Continuation Context — Phase 6** section in [`backend-plan.md`](./backend-plan.md) for complete implementation details.

### Phase 7 — Sharing & Public Links

See the **Continuation Context — Phase 7** section in [`backend-plan.md`](./backend-plan.md).

Files to create:
- `src/modules/shares/` — 4 files
- `src/modules/public-links/` — 4 files
- `src/jobs/cleanup.job.ts`

Uncomment the Phase 7 stubs in `src/bootstrap.ts` and `src/app.ts`.

---

## API Documentation

See [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md) for full endpoint reference including request/response examples for all implemented phases (Auth, Folders, Uploads, Files).
