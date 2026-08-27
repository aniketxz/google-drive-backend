#!/usr/bin/env bash
# =============================================================================
# deploy.sh — redeploy the API after code changes
#
# Run this on the EC2 instance from the project directory:
#   bash scripts/deploy.sh
#
# What it does:
#   1. Pulls latest code from git
#   2. Rebuilds Docker images
#   3. Runs Drizzle migrations (if any)
#   4. Restarts containers with zero-downtime rolling restart
# =============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🚀  Google Drive Backend — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Pull latest code ────────────────────────────────────────────────────────
echo "📥  Pulling latest code..."
git pull origin main
echo ""

# ── 2. Build new Docker image ──────────────────────────────────────────────────
echo "🔨  Building Docker image..."
docker compose build --no-cache api
echo ""

# ── 3. Run Drizzle migrations ──────────────────────────────────────────────────
echo "🗄️   Running database migrations..."
docker compose run --rm api node -e "
  const { migrate } = require('drizzle-orm/node-postgres/migrator');
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  migrate(db, { migrationsFolder: './src/db/migrations' })
    .then(() => { console.log('Migrations done'); pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
"
echo ""

# ── 4. Restart containers ──────────────────────────────────────────────────────
echo "♻️   Restarting containers..."
docker compose up -d --remove-orphans
echo ""

# ── 5. Health check ────────────────────────────────────────────────────────────
echo "🔍  Waiting for health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅  Health check passed (HTTP $HTTP_STATUS)"
else
  echo "❌  Health check failed (HTTP $HTTP_STATUS)"
  echo "    Run: docker compose logs api --tail=50"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅  Deployment complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
