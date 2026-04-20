# /seed-reset — Brzi reset lokalne baze

Destruktivni full reset lokalne dev baze. Koristi **samo na lokalnoj bazi** (`localhost`). **Nikad** na produkciji.

## Kontrola sigurnosti (obavezno prije bilo čega)

1. Provjeri da `$DATABASE_URL` pokazuje na `localhost` ili `127.0.0.1`:
   ```bash
   echo "$DATABASE_URL" | grep -E 'localhost|127\.0\.0\.1' || { echo "ABORT: not local DB"; exit 1; }
   ```
2. Ako nije lokalna — **PREKINI**, pitaj korisnika.

## Koraci

1. **Drop sve tabele** (clean slate):
   ```bash
   psql "$DATABASE_URL" -c "
     DO \$\$ DECLARE r RECORD;
     BEGIN
       FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
         EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
       END LOOP;
       FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
         EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
       END LOOP;
     END \$\$;
   "
   ```

2. **Push schema** iz Drizzle-a:
   ```bash
   pnpm --filter @workspace/db run push
   ```

3. **Seed osnovnih podataka** (admin + 5 kategorija + 12 proizvoda):
   ```bash
   pnpm --filter @workspace/scripts run seed
   ```

4. **(Opciono) Seed QA test proizvoda:**
   ```bash
   pnpm --filter @workspace/scripts run seed:qa
   ```

5. **Verifikacija** — provjeri count:
   ```bash
   psql "$DATABASE_URL" -c "SELECT
     (SELECT COUNT(*) FROM users) as users,
     (SELECT COUNT(*) FROM products) as products,
     (SELECT COUNT(*) FROM categories) as categories;"
   ```

## Kredencijali nakon seed-a

- **Admin**: `admin@store.com` / `Admin123!`
- **Baza**: `pixelcodes` (ili ono što je u `$DATABASE_URL`)

## Kada koristiti

- Schema se promijenila pa postojeći podaci blokiraju `push`
- Testiranje migracije od nule
- Nakon mnogo dev ciklusa kad je baza "prljava"

## Kada NE koristiti

- Na produkciji — **nikad**
- Ako imaš test podatke koji su ti vrijedni — backup prvo:
  ```bash
  pg_dump "$DATABASE_URL" > /tmp/pxc-backup-$(date +%s).sql
  ```
