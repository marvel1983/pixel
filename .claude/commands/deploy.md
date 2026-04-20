# Deploy – Pixel-Storefront (diginek.com)

## How deploys work

**Push to `main` → GitHub Actions runs automatically → deploys to the Contabo VPS.**

There is nothing to run manually. Just commit and push:

```bash
git add <files>
git commit -m "your message"
git push origin main
```

That's it. GitHub Actions takes it from there (~5–8 min).

---

## Before pushing — checklist

1. **Lockfile in sync?**  
   If you changed `package.json` (added/removed a dependency), run `pnpm install` first so `pnpm-lock.yaml` is updated. CI uses `--frozen-lockfile` and will fail if they're out of sync.

2. **TypeScript errors?**  
   `pnpm run typecheck` — fix anything before pushing.

3. **DB schema changes?**  
   Don't use `drizzle-kit push --force` (it drops columns). Instead add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` line to the deploy script in `.github/workflows/deploy.yml`.

---

## What the deploy script does (`.github/workflows/deploy.yml`)

1. Installs deps (`pnpm install --frozen-lockfile`)
2. Fixes `@swc/helpers` symlink (needed for pdfkit/fontkit)
3. Builds storefront (Vite → static files)
4. Builds API server (esbuild → `dist/index.mjs`)
5. Runs safe `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations
6. Reloads PM2 (`pm2 reload pixel-api --update-env`)
7. Syncs Nginx config + reloads Nginx

---

## Server details

| | |
|---|---|
| **Domain** | diginek.com |
| **VPS IP** | 144.91.69.182 (Contabo) |
| **SSH** | `ssh root@144.91.69.182` — password: `PajaPatak83#` |
| **App path** | `/var/www/pixel-storefront` |
| **PM2 process** | `pixel-api` (port 8080) |
| **Check logs** | `pm2 logs pixel-api --lines 50` |
| **Restart manually** | `pm2 restart pixel-api` |

> ⚠️ 109.199.113.232 is the **Metenzi** server — NOT diginek.com. Always SSH to 144.91.69.182.

---

## Check deploy status

```bash
gh run list --limit 5
gh run view <run-id> --log-failed   # if it failed
```
