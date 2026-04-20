# /push — Commit & push promjene

Stage sve izmijenjene fajlove, napravi commit s kratkom porukom koja opisuje šta je urađeno, i pushaj na `origin main`. Koristi `git pull --rebase` prije pusha ako je potrebno.

## Koraci

1. `git status` — provjeri šta je izmijenjeno
2. `git diff --stat` — kratki pregled promjena
3. `git add` samo relevantnih fajlova (nikad `.env` ili credentials)
4. `git commit -m "..."` — poruka treba biti konkretna (šta, ne kako)
5. `git pull --rebase origin main` — sinkronizacija s remote
6. `git push origin main`

## Commit poruka format

```
kratki opis promjene (max 72 znaka)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Pravila

- Nikad ne commitaj `.env`, lozinke, API ključeve
- Nikad `--no-verify` ili `--force` push na main
- Ako push odbijen → `git pull --rebase origin main` pa pokušaj ponovo
- Ako typecheck nije prošao → ne pushaj dok se ne popravi
