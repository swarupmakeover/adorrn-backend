#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${BOLD}── $* ──${NC}"; }

usage() {
  cat <<EOF
Usage: ./db.sh <command>

Commands:
  up          Start Postgres container
  down        Stop Postgres container
  restart     Restart Postgres container
  reset       Stop and delete Postgres data volume
  ps          Show Postgres container status
  migrate     Run database schema migration
  seed        Seed default data (homepage sections)
  setup       Full: up + migrate + seed
  sql <file>  Run a custom SQL file against the database
  console     Open interactive psql shell
  logs        Tail Postgres container logs
EOF
  exit 1
}

cmd="${1:-}"
shift 2>/dev/null || true

case "$cmd" in
  up)
    step "Starting Postgres container"
    docker compose up -d
    info "Waiting for Postgres to be ready..."
    until docker compose exec -T postgres pg_isready -U adorrn >/dev/null 2>&1; do
      sleep 1
    done
    info "Postgres is ready on port 5432"
    ;;

  down)
    step "Stopping Postgres container"
    docker compose down
    info "Container stopped (data volume preserved)"
    ;;

  restart)
    step "Restarting Postgres container"
    docker compose restart
    info "Container restarted"
    ;;

  reset)
    step "Resetting database — stopping and deleting data volume"
    docker compose down -v
    info "Data volume deleted. Run './db.sh up' to start fresh"
    ;;

  ps)
    step "Container status"
    docker compose ps
    ;;

  migrate)
    step "Running database migration"
    npm run db:migrate
    info "Migration complete"
    ;;

  seed)
    step "Seeding default data"
    npm run db:seed
    info "Seed complete"
    ;;

  setup)
    step "Full setup — starting Postgres + migrating + seeding"
    "$0" up
    "$0" migrate
    "$0" seed
    info "Setup complete! Run 'npm run dev' to start the server"
    ;;

  sql)
    file="${1:-}"
    if [ -z "$file" ]; then
      error "Usage: ./db.sh sql <file.sql>"
      exit 1
    fi
    if [ ! -f "$file" ]; then
      error "File not found: $file"
      exit 1
    fi
    step "Running SQL file: $file"
    docker compose exec -T postgres psql -U adorrn -d adorrn_herbal < "$file"
    info "SQL file executed"
    ;;

  console)
    step "Opening psql console"
    docker compose exec -it postgres psql -U adorrn -d adorrn_herbal
    ;;

  logs)
    step "Tailing Postgres logs"
    docker compose logs -f
    ;;

  *)
    error "Unknown command: $cmd"
    usage
    ;;
esac
