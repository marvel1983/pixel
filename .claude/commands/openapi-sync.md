# /openapi-sync — Regenerate API client after spec change

Nakon što se edituje OpenAPI spec (`lib/api-spec/`), treba regenerirati generirane pakete i provjeriti da kod i dalje prolazi typecheck.

## Koraci

1. **Provjeri da si stvarno mijenjao spec** — `git diff lib/api-spec/` ne smije biti prazno. Ako jest, prekini.

2. **Pokreni codegen:**
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
   Ovo regeneriše:
   - `lib/api-client-react/` — React Query hooks koje koristi storefront
   - `lib/api-zod/` — Zod schemas koje koristi API server

3. **Provjeri koji su fajlovi regenerisani:**
   ```bash
   git status lib/api-client-react/ lib/api-zod/
   ```

4. **Pokreni typecheck** — da osiguraš da novi tipovi ne lome postojeći kod:
   ```bash
   pnpm run typecheck
   ```

5. **Ako typecheck pada** → razlog je vjerovatno jedno od:
   - Frontend koristi hook sa starim imenom → pretraži `Grep` za staro ime
   - API server route handler ima mismatched Zod schema → popravi usage
   - Mijenjao si required field → update sve call sites

6. **Commit sve zajedno** (spec + generirane fajlove + promjene u usage):
   ```bash
   git add lib/api-spec/ lib/api-client-react/ lib/api-zod/ artifacts/
   git commit -m "api: <opis promjene>"
   ```

## Pravila

- **Nikad ne mijenjaj `lib/api-client-react/` ili `lib/api-zod/` ručno.** Uvijek preko spec-a + codegen.
- **Generirane fajlove UVIJEK commituj** — CI ne regeneriše, očekuje da su u repou.
- Ako spec mijenja response shape, provjeri i mocks u `artifacts/storefront/tests/`.
