# /sync-swc — Sync Pixel changes into SoftwareCodes (SWC)

Cherry-pick new Pixel commits into the SoftwareCodes (SWC) repo and trigger
its production deploy on `155.133.22.40`. Use this whenever you've shipped
something on Pixel that should also run on SWC.

## When to use

- After a feature lands on `marvel1983/pixel` `main` that should benefit SWC.
- Periodically (e.g. weekly) to keep SWC up to date with Pixel security
  fixes and improvements.

## When NOT to use

- For SWC-specific feature work (branding, custom homepage, etc.) — that
  goes directly on the SWC repo without touching Pixel.

## Mental model

The two repos diverged through SWC's rebrand. A full `git merge` would
conflict on every rebrand-touch file. **Cherry-pick** is the right tool:
it brings over individual commits cleanly and only conflicts when the
specific commit changes a file that SWC has rebranded.

Many Pixel commits will turn out to be **empty cherry-picks** because
SWC already has the equivalent change via earlier syncs or independent
implementation. That is normal — `git cherry-pick --skip` past them.

## Setup (one-time, only if SWC is not cloned yet)

```bash
cd "/Users/rickyrivera/Dropbox/DINO/REPLIT/PXC CLONE 2"
git clone https://github.com/JoeLogavina/software-codes.git SWC
cd SWC
git remote add pixel https://github.com/marvel1983/pixel.git
git fetch pixel
```

After this, the SWC repo is at `/Users/rickyrivera/Dropbox/DINO/REPLIT/PXC CLONE 2/SWC/`
and `pixel` is registered as an upstream remote.

## Workflow steps (run this each sync)

### 1. Enter SWC and fetch latest Pixel

```bash
cd "/Users/rickyrivera/Dropbox/DINO/REPLIT/PXC CLONE 2/SWC"
git fetch pixel
```

### 2. List what's new in Pixel that SWC doesn't have

```bash
git log --oneline main..pixel/main
```

Read the list. Decide:
- **Apply all** → use a range cherry-pick.
- **Skip some** → cherry-pick only the SHAs you want.
- **Inappropriate for SWC** → skip commits that hardcode `pixelcodes.com`,
  reference Pixel-only branding, or are pure `.claude/settings.json`
  utilities that don't belong in SWC.

### 3. Cherry-pick

For a contiguous range (oldest to newest):
```bash
git cherry-pick <oldest-sha>^..<newest-sha>
```

For specific commits:
```bash
git cherry-pick <sha1> <sha2> <sha3>
```

### 4. Handle the 3 possible outcomes per commit

**Clean apply** — git creates the new commit, no action needed.

**Empty cherry-pick** ("The previous cherry-pick is now empty…") — SWC
already has the equivalent change. Skip with:
```bash
git cherry-pick --skip
```

**Real conflict** ("Merge conflict in …") — open the conflicting file,
resolve manually, then:
```bash
git add <resolved-files>
git cherry-pick --continue
```

If a commit is genuinely inappropriate for SWC (e.g. references `pixelcodes.com`
explicitly), skip it instead of forcing it:
```bash
git cherry-pick --skip
```

To bail out entirely:
```bash
git cherry-pick --abort
```

### 5. Verify the build is sane

```bash
pnpm install --prefer-offline   # only if pnpm-lock.yaml changed
pnpm run typecheck
```

If typecheck fails, fix in SWC before pushing. Don't push broken code.

### 6. Push to SWC main → deploy fires automatically

```bash
git push origin main
```

This triggers the GitHub Actions workflow on `JoeLogavina/software-codes`
which deploys to the SWC VPS at `155.133.22.40`.

### 7. Watch the deploy

```bash
gh run list --limit 1 --repo JoeLogavina/software-codes
gh run view <run-id> --repo JoeLogavina/software-codes --log-failed   # if failed
```

Wait for `completed / success`. Typical run time is ~2–3 minutes.

### 8. Verify production

```bash
curl -sf http://155.133.22.40/api/healthz
curl -sS -X POST http://155.133.22.40/api/track \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 11111111-2222-4333-8444-555555555555" \
  -d '{"events":[{"eventType":"page_view","occurredAt":"2026-01-01T00:00:00.000Z","pagePath":"/sync-test"}]}' \
  -w "\nHTTP %{http_code}\n"
```

Expect `{"status":"ok"}` and `{"accepted":1}` HTTP 202 respectively.

## Server details

| | |
|---|---|
| **SWC URL** | http://155.133.22.40 |
| **GitHub repo** | https://github.com/JoeLogavina/software-codes |
| **Local clone** | `/Users/rickyrivera/Dropbox/DINO/REPLIT/PXC CLONE 2/SWC` |
| **Pixel remote** | `pixel` (`https://github.com/marvel1983/pixel.git`) |
| **Deploy target** | Contabo VPS at 155.133.22.40 |

> Note: `software-codes.com` (the domain) currently points to a separate
> WordPress site, **not** the storefront. Always verify against the
> `155.133.22.40` IP for the storefront API.

## Common skip categories

These commit types are usually safe to skip when they hit SWC:

- **Empty cherry-picks** — SWC already has the change. Skip.
- **Pixel-branded `.claude/settings.json` utility additions** — SWC has
  its own settings tuned for `155.133.22.40`. Skip with --skip.
- **`pixelcodes.com` URL hardcodes** — wrong domain for SWC. Skip.
- **Pixel-only deploy.yml branding** — SWC's deploy.yml is structurally
  different on env vars but auto-merge usually works for the SQL
  migration sections. Resolve manually if conflict is real.

## Cherry-pick conflict resolution priorities

When resolving real conflicts, the priorities are:
1. **Keep SWC branding** (logo paths, colors, copy, `.env` references).
2. **Take Pixel logic** (security fixes, schema changes, new features).
3. **Merge both** for files like `deploy.yml` where SWC has its own
   structure but you want Pixel's new SQL migrations on the bottom.

## After-sync sanity checks

- New tracking tables (if applicable) are created on SWC's prod DB by
  the deploy migrations — verify with the curl `/api/track` test.
- Admin can log in: try `https://155.133.22.40/admin` (CSRF + Turnstile
  rules apply just like Pixel).
- Customer Journey panel renders on a recent SWC order (only orders
  created **after** the journey deploy will have a session_id).
