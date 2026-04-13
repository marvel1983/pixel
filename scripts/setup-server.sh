#!/usr/bin/env bash
# =============================================================================
# Pixel-Storefront — Contabo VPS initial server setup
# Run once as root on a fresh Ubuntu 24.04 server:
#   bash scripts/setup-server.sh
# =============================================================================

set -euo pipefail

REPO_URL="https://github.com/marvel1983/pixel.git"
APP_DIR="/var/www/pixel-storefront"
DB_NAME="pixelcodes"
DB_USER="pixelcodes"

echo "============================================"
echo "  Pixel-Storefront Server Setup"
echo "  Ubuntu 24.04 | Contabo VPS"
echo "============================================"

# ── 1. System update ─────────────────────────────────────────────────────────
echo "→ Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Node.js 22 LTS ────────────────────────────────────────────────────────
echo "→ Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── 3. pnpm ──────────────────────────────────────────────────────────────────
echo "→ Installing pnpm..."
npm install -g pnpm@10
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
echo 'export PNPM_HOME="/root/.local/share/pnpm"' >> /root/.bashrc
echo 'export PATH="$PNPM_HOME:$PATH"' >> /root/.bashrc

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
echo "→ Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 5. PostgreSQL ─────────────────────────────────────────────────────────────
echo "→ Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql

echo "→ Creating database and user..."
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
  END IF;
END \$\$;
SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}' \gexec
  -- no-op if exists
\q
SQL

sudo -u postgres createdb "${DB_NAME}" --owner="${DB_USER}" 2>/dev/null || echo "  (database already exists)"

echo ""
echo "  ⚠️  IMPORTANT: Set a strong password for the DB user:"
echo "     sudo -u postgres psql -c \"ALTER ROLE ${DB_USER} PASSWORD 'YOUR_STRONG_PASSWORD';\""
echo ""

# ── 6. Nginx ─────────────────────────────────────────────────────────────────
echo "→ Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ── 7. Clone repository ──────────────────────────────────────────────────────
echo "→ Cloning repository..."
mkdir -p "$(dirname "$APP_DIR")"

if [ -d "$APP_DIR/.git" ]; then
  echo "  (repo already cloned, pulling latest)"
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 8. Create .env file ──────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo "→ Creating .env template..."
  cat > "$APP_DIR/.env" <<'ENV'
NODE_ENV=production
PORT=8080

# PostgreSQL connection string
DATABASE_URL=postgresql://pixelcodes:CHANGE_THIS_PASSWORD@localhost:5432/pixelcodes

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=CHANGE_THIS_TO_64_HEX_CHARS

# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=CHANGE_THIS_JWT_SECRET

# Optional: Google OAuth
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=http://YOUR_DOMAIN/api/auth/google/callback

# Optional: Email (Nodemailer)
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@yourdomain.com

PRICING_ENGINE_V2=true
ENV

  echo ""
  echo "  ⚠️  IMPORTANT: Edit $APP_DIR/.env with your real values before continuing!"
  echo "     nano $APP_DIR/.env"
  echo ""
fi

# ── 9. PM2 log directory ─────────────────────────────────────────────────────
mkdir -p /var/log/pm2

# ── 10. Nginx site config ────────────────────────────────────────────────────
echo "→ Configuring Nginx..."
cp "$APP_DIR/nginx/pixel-storefront.conf" /etc/nginx/sites-available/pixel-storefront
ln -sf /etc/nginx/sites-available/pixel-storefront /etc/nginx/sites-enabled/pixel-storefront
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 11. Firewall ─────────────────────────────────────────────────────────────
echo "→ Configuring UFW firewall..."
ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'
ufw status

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit the .env file:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  2. Install dependencies & build:"
echo "     cd $APP_DIR"
echo "     pnpm install --frozen-lockfile"
echo "     PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/storefront run build"
echo "     NODE_ENV=production pnpm --filter @workspace/api-server run build"
echo "     pnpm run typecheck:libs"
echo ""
echo "  3. Push DB schema:"
echo "     source $APP_DIR/.env && pnpm --filter @workspace/db run push"
echo ""
echo "  4. Start the API with PM2:"
echo "     cd $APP_DIR"
echo "     pm2 start ecosystem.config.cjs"
echo "     pm2 save"
echo ""
echo "  5. Add GitHub Actions secrets (in your repo Settings → Secrets):"
echo "     CONTABO_HOST     = 144.91.69.182"
echo "     CONTABO_USER     = root"
echo "     CONTABO_SSH_KEY  = (your SSH private key)"
echo "     CONTABO_PORT     = 22"
echo ""
echo "  6. Visit: http://144.91.69.182"
echo "============================================"
