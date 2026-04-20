# DB Migration – Pixel-Storefront

## Zlatno pravilo

**Nikad ne koristiti `drizzle-kit push --force`** — briše kolone koje nisu u schemi. Jednom je skoro uništilo produkcijsku bazu.

---

## Kako dodati novu kolonu (jedini siguran način)

### Korak 1 — Dodaj u Drizzle schema

Fajlovi su u `lib/db/src/schema/`. Svaka tabela ima svoj fajl.

Primjer za `site_settings`:
```typescript
// lib/db/src/schema/settings.ts
export const siteSettings = pgTable("site_settings", {
  // ... postojeće kolone ...
  mojaNovaKolona: varchar("moja_nova_kolona", { length: 255 }),
});
```

### Korak 2 — Dodaj migraciju u deploy.yml

Otvori `.github/workflows/deploy.yml` i dodaj liniju u sekciju "Applying safe DB schema additions":

```yaml
psql "$DATABASE_URL" -c "ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS moja_nova_kolona VARCHAR(255);" || true
```

Tipovi po PostgreSQL:
| Drizzle tip | PostgreSQL tip |
|---|---|
| `varchar(n)` | `VARCHAR(n)` |
| `text` | `TEXT` |
| `integer` | `INTEGER` |
| `boolean` | `BOOLEAN` |
| `numeric(10,2)` | `NUMERIC(10,2)` |
| `jsonb` | `JSONB` |
| `timestamp` | `TIMESTAMP` |

### Korak 3 — Push

```bash
git add lib/db/src/schema/ .github/workflows/deploy.yml
git commit -m "db: add moja_nova_kolona to site_settings"
git push origin main
```

Deploy automatski primijeni `ALTER TABLE` na produkcijsku bazu.

---

## Dodavanje novog enum value-a

```yaml
psql "$DATABASE_URL" -c "ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'NOVI_STATUS';" || true
```

---

## Šta NE raditi

```bash
# ❌ NIKAD OVO — može obrisati kolone u produkciji
pnpm --filter @workspace/db run push-force

# ✅ Ovo je ok za lokalni dev (ne produkcija)
pnpm --filter @workspace/db run push
```

---

## Provjera kolona na produkciji (SSH)

```bash
set -a; source /var/www/pixel-storefront/.env; set +a
psql "$DATABASE_URL" -c "\d site_settings"   # pregled svih kolona tabele
```
