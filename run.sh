#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}\n"; }

cleanup() {
  info "Shutting down..."
  docker compose down 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

step "Checking prerequisites"

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install it from https://nodejs.org (v20+)"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  error "Node.js v20+ required, found v$(node -v). Upgrade from https://nodejs.org"
  exit 1
fi
info "Node.js $(node -v) — OK"

if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Install from https://docs.docker.com/engine/install/"
  exit 1
fi
info "Docker $(docker --version | cut -d' ' -f3 | tr -d ,) — OK"

if docker compose version &>/dev/null; then
  DOCKER_COMPOSE="docker compose"
elif docker-compose --version &>/dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  error "Docker Compose is not installed. Install from https://docs.docker.com/compose/install/"
  exit 1
fi
info "$($DOCKER_COMPOSE version) — OK"

if ! docker info &>/dev/null; then
  warn "Cannot connect to Docker daemon."
  warn "This usually means your user isn't in the 'docker' group."
  warn ""
  warn "  ${BOLD}Fix:${NC} sudo usermod -aG docker \$USER"
  warn "       Then log out and back in (or run: newgrp docker)"
  warn ""
  warn "  ${BOLD}Or use Neon free tier instead:${NC}"
  warn "      1. Sign up at https://neon.tech"
  warn "      2. Create a project, copy the connection string"
  warn "      3. Edit .env and paste it as DATABASE_URL"
  warn "      4. Run: npm run db:migrate && npm run db:seed && npm run dev"
  warn ""
  read -rp "Retry after fixing? [Y/n] " -n1 reply
  echo
  if [[ "${reply:-y}" =~ ^[Yy]$ ]]; then
    exec "$0"
  fi
  exit 1
fi

step "Starting PostgreSQL"

$DOCKER_COMPOSE up -d
info "Waiting for Postgres to be ready..."
for i in $(seq 30); do
  if $DOCKER_COMPOSE exec -T postgres pg_isready -U adorrn &>/dev/null; then
    info "Postgres is ready on port 5432"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Postgres failed to start. Check logs: $DOCKER_COMPOSE logs postgres"
    exit 1
  fi
  sleep 1
done

step "Installing dependencies"

npm install --silent
info "Dependencies installed"

step "Running database migration"

npm run db:migrate
info "Migration complete"

step "Seeding default data"

npm run db:seed
info "Seed complete"

step "Starting development server"

info "Swagger UI: ${BOLD}http://localhost:3001/docs${NC}"
info "Health:     ${BOLD}http://localhost:3001/health${NC}"
info "Press Ctrl+C to stop\n"

npm run dev
