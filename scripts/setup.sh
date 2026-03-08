#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   talora - Setup inicial${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Check Docker
echo -e "${YELLOW}Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker no esta instalado. Instala Docker Desktop primero.${NC}"
    exit 1
fi
if ! docker info &> /dev/null 2>&1; then
    echo -e "${RED}Docker no esta corriendo. Abre Docker Desktop primero.${NC}"
    exit 1
fi
echo -e "${GREEN}Docker OK${NC}"
echo ""

# 2. Check bun
echo -e "${YELLOW}Verificando Bun...${NC}"
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Bun no esta instalado. Instala Bun: curl -fsSL https://bun.sh/install | bash${NC}"
    exit 1
fi
echo -e "${GREEN}Bun OK${NC}"
echo ""

# 3. Collect configuration
echo -e "${YELLOW}Configuracion del proyecto${NC}"
echo ""

read -p "Email del admin [admin@illuminato.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@illuminato.com}

read -sp "Password del admin [admin]: " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
echo ""

read -p "OpenAI API Key: " OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}OpenAI API Key es requerida${NC}"
    exit 1
fi

read -p "Evolution API Key [dev-api-key]: " EVOLUTION_API_KEY
EVOLUTION_API_KEY=${EVOLUTION_API_KEY:-dev-api-key}

echo ""
echo -e "${YELLOW}Google Calendar (opcional - presiona Enter para saltar)${NC}"
read -p "Google Client ID: " GOOGLE_CLIENT_ID
read -p "Google Client Secret: " GOOGLE_CLIENT_SECRET

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo ""
echo -e "${GREEN}JWT Secret generado automaticamente${NC}"

# 4. Generate DB password
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# 5. Create .env files
echo ""
echo -e "${YELLOW}Creando archivos de configuracion...${NC}"

# Root .env (for docker-compose)
cat > .env << ENVEOF
EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
POSTGRES_USER=talora
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=talora
ENVEOF

# Backend .env
cat > apps/backend/.env << ENVEOF
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
POSTGRES_USER=talora
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=talora
DATABASE_URL=postgresql://talora:${POSTGRES_PASSWORD}@localhost:5433/talora
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
TIMEZONE=America/Argentina/Buenos_Aires
WEBHOOK_BASE_URL=http://host.docker.internal:3001
CORS_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
ENVEOF

# Frontend .env
cat > apps/frontend/.env << ENVEOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENVEOF

echo -e "${GREEN}Archivos .env creados${NC}"

# 6. Install dependencies
echo ""
echo -e "${YELLOW}Instalando dependencias...${NC}"
bun install
echo -e "${GREEN}Dependencias instaladas${NC}"

# 7. Start Docker services
echo ""
echo -e "${YELLOW}Levantando servicios Docker...${NC}"
docker compose up -d
echo -e "${GREEN}Servicios Docker corriendo${NC}"

# 8. Wait for PostgreSQL
echo -e "${YELLOW}Esperando que PostgreSQL este listo...${NC}"
sleep 5
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U talora &> /dev/null; then
        break
    fi
    sleep 1
done
echo -e "${GREEN}PostgreSQL listo${NC}"

# 9. Run migrations
echo ""
echo -e "${YELLOW}Corriendo migraciones...${NC}"
cd apps/backend && bun run migrate && cd ../..
echo -e "${GREEN}Migraciones completadas${NC}"

# 10. Done!
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup completado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Para iniciar el proyecto:"
echo -e "  1. Backend:  ${BLUE}cd apps/backend && bun run dev${NC}"
echo -e "  2. Frontend: ${BLUE}cd apps/frontend && bun run dev${NC}"
echo ""
echo -e "URLs:"
echo -e "  Panel admin: ${BLUE}http://localhost:3000${NC}"
echo -e "  API:         ${BLUE}http://localhost:3001${NC}"
echo -e "  Evolution:   ${BLUE}http://localhost:8080${NC}"
echo ""
echo -e "Login: ${BLUE}${ADMIN_EMAIL}${NC} / (la password que ingresaste)"
