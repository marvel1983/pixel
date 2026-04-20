# SSH Debug – Pixel-Storefront (diginek.com)

## SSH na server

```bash
ssh root@144.91.69.182
# password: PajaPatak83#
```

> ⚠️ 109.199.113.232 je **Metenzi** server — nije diginek.com. Uvijek koristi 144.91.69.182.

---

## PM2 — najčešće komande

```bash
pm2 status                          # pregled svih procesa
pm2 logs pixel-api --lines 50       # posljednjih 50 linija logova
pm2 logs pixel-api --lines 200      # više logova
pm2 restart pixel-api               # restart
pm2 reload pixel-api --update-env   # reload bez downtime (čita novi .env)
pm2 stop pixel-api                  # stop
```

---

## Dijagnoza pada servera

### 1. Provjeri status
```bash
pm2 status
```
Ako je status `errored` ili restart count visok → server se ruši u loopu.

### 2. Provjeri logove
```bash
pm2 logs pixel-api --lines 100
```
Traži:
- `Error: Cannot find module` → nedostaje npm paket ili symlink
- `ECONNREFUSED` → baza nije dostupna
- `UnhandledPromiseRejection` → async greška bez try/catch

### 3. Provjeri error log direktno
```bash
cat /root/.pm2/logs/pixel-api-error.log | tail -50
```

---

## Nginx

```bash
nginx -t                          # test konfiguracije
systemctl reload nginx            # reload bez downtime
systemctl status nginx            # status
cat /etc/nginx/sites-available/pixel-storefront   # pregled config-a
```

---

## Aplikacija

```bash
cd /var/www/pixel-storefront

# Provjeri .env
cat .env

# Provjeri da li je build svjež
ls -la artifacts/api-server/dist/

# Ručni build (ako treba)
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
NODE_ENV=production pnpm --filter @workspace/api-server run build
pm2 reload pixel-api --update-env
```

---

## @swc/helpers symlink (pdfkit crash fix)

Ako PM2 logovi pokazuju `Cannot find module '@swc/helpers/...'`:

```bash
cd /var/www/pixel-storefront
mkdir -p node_modules/@swc
SWC_PATH=$(ls -d node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers 2>/dev/null | head -1)
ln -sfn "$SWC_PATH" node_modules/@swc/helpers
pm2 restart pixel-api
```

---

## Baza

```bash
# Provjeri konekciju
set -a; source /var/www/pixel-storefront/.env; set +a
psql "$DATABASE_URL" -c "SELECT 1;"

# Provjeri tabele
psql "$DATABASE_URL" -c "\dt"
```
