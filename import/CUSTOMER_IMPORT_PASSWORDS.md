# Customer Import & Password Encryption — How It Works

This document explains the full pipeline used by the Metenzi B2B CRM for
importing customers (and branches) from CSV/XLSX, including how passwords
are handled — both when the source file already contains a password hash and
when one needs to be generated.

---

## 1. High-level flow

```
Admin UI  ──upload CSV/XLSX──▶  POST /api/admin/imports/jobs
                                       │
                                       ▼
                          import.repository inserts row in
                          import_jobs (status = 'pending')
                                       │
                                       ▼
                          BullMQ enqueues job in `imports` queue
                                       │
                                       ▼
                          import.worker.ts picks the job up
                                       │
                                       ▼
                          import-processor.service.ts (router)
                                       │
                                       ▼
                          import-processor/customers.ts
                          (or branches / products / sold-keys / active-keys)
                                       │
                                       ▼
                          For each row:
                            - map columns → fields (mappingConfig)
                            - validate required fields
                            - check duplicate policy
                            - INSERT customer + clientUser
                              (passwordHash resolved per rules below)
                            - optionally generate invite token
                                       │
                                       ▼
                          Errors collected → import_errors table
                          Generated branch passwords → CSV in object storage
                          Job status updated (completed/failed)
```

---

## 2. Files involved

### Core import logic (customers + branches)
| File | Role |
|------|------|
| `server/services/import-processor/customers.ts` | The actual customer + branch row processor. Decides whether to keep a provided hash or generate a new password + bcrypt hash. |
| `server/services/import-processor/helpers.ts` | Shared types (`ImportContext`, `ImportError`), DB handle, `mapRowToFields`, `stripHtml`, `checkDuplicatePolicy`, lookup caches. |
| `server/services/import-processor.service.ts` | Top-level router: dispatches to the right `processXxxImport` function based on `importType`. |
| `server/services/import.service.ts` | Higher-level service: file upload to object storage, error recording, invite-token generation, **`generateSecurePassword()`**, required-fields metadata. |
| `server/queue/workers/import.worker.ts` | BullMQ worker. Pulls jobs, sets status, parses CSV/XLSX, calls the processor, finalises the job. |
| `server/repositories/import.repository.ts` | DB access for `import_jobs`, `import_errors`, `import_mapping_templates`, `customer_invite_tokens`. |

### HTTP routes (admin upload + management)
| File | Role |
|------|------|
| `server/routes/admin/imports/jobs.ts` | `POST /api/admin/imports/jobs` (file upload, multipart), `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/retry`, `DELETE /jobs/:id`, status polling. |
| `server/routes/admin/imports/helpers.ts` | Multer setup, mapping-template helpers, response shaping. |
| `server/routes/admin/imports/archives.ts` | Long-term import history / archived job downloads. |
| `server/routes/admin/imports/index.ts` | Express router wiring. |

### Password verification + encryption
| File | Role |
|------|------|
| `server/utils/passwordVerify.ts` | The single source of truth for **verifying** any stored hash. Supports two formats: (1) **bcrypt** (`$2…`) and (2) **ASP.NET Identity v3 PBKDF2** (legacy hashes from the old .NET app). Also exposes `getHashType()`. |
| `server/services/auth.service.ts` | The login/registration service. On every successful login it transparently re-hashes legacy ASP.NET hashes into bcrypt and stores them back. Also handles password resets / `createClientUser` / `upsertClientUserForCustomer`. |
| `server/routes/customer/auth/login.ts` | The customer-facing `POST /api/customer/auth/login` route. Calls `authService.authenticateClient()`. |

---

## 3. How passwords are handled during customer import

The function `resolvePasswordHash()` in
`server/services/import-processor/customers.ts` decides what to do per row:

```ts
async function resolvePasswordHash(providedHash?: string) {
  const hashType = providedHash ? getHashType(providedHash) : 'unknown';
  const hasProvidedHash = hashType !== 'unknown';

  if (hasProvidedHash) {
    // CSV already contained a recognised hash → keep it as-is
    return { passwordHash: providedHash!, hasProvidedHash: true };
  }

  // No usable hash → generate a temp password and bcrypt-hash it
  const tempPassword = nanoid(16);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  return { passwordHash, hasProvidedHash: false };
}
```

`getHashType()` returns `'bcrypt'`, `'aspnet-v3'` or `'unknown'`. Anything
recognised is accepted verbatim — meaning you can migrate a customer base
from a legacy .NET app into Metenzi by simply exporting the ASP.NET Identity
v3 PBKDF2 hashes into the CSV column mapped to `passwordHash`. Users can
log in with their existing passwords on day one.

The new `clientUsers` row is then inserted with these flags:

| `hasProvidedHash` | `status` | `forcePasswordChange` | `emailVerified` |
|-------------------|----------|------------------------|-----------------|
| `true` (CSV had hash) | `active` | `false` | `true` |
| `false` (we generated one) | `pending` | `true` | `false` |

When `hasProvidedHash === false` **and** the import option
`sendInvitations` is enabled, the importer also calls
`importService.generateCustomerInviteToken(insertedUser.id)` which inserts a
32-byte hex token in `customer_invite_tokens` valid for 7 days. The temp
password generated in this case is **never** persisted or shown to anyone —
the user must redeem the invite token to set a real password.

---

## 4. How passwords are handled during branch import

Branches use a slightly different rule because they typically log in with a
machine-printed username/password (POS terminals, kiosks):

```ts
async function resolveBranchPasswordHash(providedHash?: string) {
  const hashType = providedHash ? getHashType(providedHash) : 'unknown';
  if (hashType !== 'unknown') {
    return { finalHash: providedHash!, generatedPassword: null };
  }
  const generatedPassword = importService.generateSecurePassword(); // 12-char strong
  const finalHash = await bcrypt.hash(generatedPassword, 10);
  return { finalHash, generatedPassword };
}
```

When a password is generated, the **plaintext** is collected (in memory only)
and at the end of the import the helper `saveGeneratedCredentials()` writes
a `branch-credentials-<jobId>.csv` file to object storage and stores its
path in `import_jobs.credentialsFilePath`. The admin can download this file
once from the UI to distribute to the branches. The plaintext password is
**never** written to the application database.

`generateSecurePassword()` (in `server/services/import.service.ts`) uses
`crypto.randomBytes(12)` to pick from a 70-character alphabet
(uppercase + lowercase + digits + `!@#$%&*`). It is cryptographically
secure (not `Math.random`).

---

## 5. The two supported hash formats

### a) bcrypt (`$2…`)
The native, modern format. Cost factor 10. Used for:
- All passwords created or changed inside Metenzi.
- All passwords generated during import.
- All passwords migrated from legacy on first successful login.

Verified with `bcrypt.compare(plaintext, storedHash)`.

### b) ASP.NET Identity v3 (PBKDF2)
A base64 blob produced by `Microsoft.AspNetCore.Identity.PasswordHasher<T>`
when `CompatibilityMode = IdentityV3`.

Binary layout:
```
byte  0       : format marker (0x01)
bytes 1-4     : PRF id (uint32 BE)  → 0=SHA1, 1=SHA256, 2=SHA512
bytes 5-8     : iteration count (uint32 BE)
bytes 9-12    : salt length in bytes (uint32 BE)
bytes 13..    : salt
bytes ..end   : derived subkey
```

`verifyAspNetIdentityV3()` in `server/utils/passwordVerify.ts` parses this
blob, runs `crypto.pbkdf2Sync(plaintext, salt, iterCount, subkeyLen, prf)`,
and compares with `crypto.timingSafeEqual()`.

This is the bridge that lets the CRM accept passwords exported from the
previous .NET CRM without forcing every reseller to reset their password.

### Transparent migration
On every successful login, `auth.service.ts` runs:
```ts
const hashType = getHashType(userWithCustomer.passwordHash);
if (hashType !== 'bcrypt') {
  const newHash = await bcrypt.hash(password, 10);
  await this.clientUsersRepo.updateClientUserPassword(userId, newHash);
}
```
So the ASP.NET v3 hash for a given user is replaced with a bcrypt hash the
first time that user logs in successfully. After everyone has logged in
once, the legacy code path stops being exercised.

---

## 6. CSV column → field mapping for customers

The admin UI lets the operator map any CSV column to a Metenzi field via a
mapping template (`import_mapping_templates`). The fields recognised by
the customer importer are:

```
name              (required)
email             (required)
contactPerson
phone
whatsapp
address
city
country
taxId
paymentTerms
creditLimit       (decimal as string, defaults to '0')
creditBalance     (decimal as string, defaults to '0')
description       (HTML stripped automatically)
vip               ('true'/'1' → true)
status            ('inactive' → inactive, anything else → active)
parentMarkup      (decimal as string)
passwordHash      ← the magic field. Must be a bcrypt or ASP.NET v3 hash.
```

For branches add: `username`, `printerType`, `fiscalDeviceType`, plus parent
linkage via one of `parentCustomerEmail` / `parentCustomerName` /
`parentCustomerId` / `parentTaxId` (chosen by `parentLinkField`).

---

## 7. Duplicate policy

`ctx.options.duplicatePolicy` controls collision behaviour and is checked
per row:

| Value | Behaviour |
|-------|-----------|
| `skip` | Existing row left untouched, counted in `skippedCount`. |
| `update` | Existing row updated with the new mapped data (passwords are **not** overwritten — only profile fields). |
| `error` | Row recorded as `DUPLICATE` in `import_errors`. |

Customers are matched by `(clientUsers.email, marketId)`.
Branches are matched by `(branches.name, marketId)`.

---

## 8. Where things are stored

| Table | What |
|-------|------|
| `import_jobs` | One row per import: status, counts, file path, mappingConfig (jsonb), options (jsonb), credentialsFilePath. |
| `import_errors` | Per-row failures with `errorCode`, `errorMessage`, `rawData`. |
| `import_mapping_templates` | Saved column→field mappings reusable across imports. |
| `customers` | The customer profile (per market). |
| `client_users` | The login record (one per customer). Holds `passwordHash`, `status`, `forcePasswordChange`, `emailVerified`. |
| `branches` | Branch profile + its own `passwordHash` and `username`. |
| `customer_invite_tokens` | 32-byte hex tokens for first-time password setup. |

CSV files (uploaded source + generated branch credentials) are stored in
object storage via `unifiedStorageService` under the `imports/` prefix.

---

## 9. Security notes & gotchas

- **No plaintext passwords ever touch the DB.** The only place a plaintext
  exists is (a) the temp password generated for customers without a hash —
  which is immediately discarded after hashing, and (b) the per-branch
  generated password — which is written **only** to a one-shot CSV in
  object storage so the admin can hand it out.
- **Trust boundary on `passwordHash` column.** The importer does **not**
  validate the strength of a provided hash beyond format detection. Anyone
  with import access can effectively impersonate any customer if they put
  a hash they know the plaintext for. Treat the import endpoint as a
  privileged admin action (it is gated by admin auth in `routes/admin`).
- **Legacy hashes are accepted forever** unless you explicitly purge them
  by forcing password resets. The transparent migration on login is the
  intended de-facto cleanup mechanism.
- **`KEY_ENCRYPTION_SECRET` (env var)** is unrelated to customer
  passwords. It encrypts *digital product keys* (CD keys / license keys)
  via `server/services/key-encryption.service.ts`, not user credentials.
  User credentials are bcrypt-hashed, not encrypted (one-way, not
  reversible).
- **No CSRF on the import upload** is needed because admin auth is via
  bearer JWT in the `Authorization` header (see `middleware/jwtAuth.ts`),
  not cookies.

---

## 10. Quick reference: who calls whom

```
admin UI
  └── POST /api/admin/imports/jobs            (routes/admin/imports/jobs.ts)
        └── importService.uploadImportFile()  (services/import.service.ts)
        └── importRepository.createImportJob()
        └── enqueue BullMQ job

import.worker.ts (queue/workers/import.worker.ts)
  └── parses CSV/XLSX
  └── ImportProcessorService.processJob()    (services/import-processor.service.ts)
        ├── processCustomerImport()           (services/import-processor/customers.ts)
        │     └── resolvePasswordHash()
        │           └── getHashType()         (utils/passwordVerify.ts)
        │           └── bcrypt.hash()
        │     └── importService.generateCustomerInviteToken()
        ├── processBranchImport()             (same file)
        │     └── resolveBranchPasswordHash()
        │           └── importService.generateSecurePassword()
        │           └── bcrypt.hash()
        │     └── saveGeneratedCredentials()  → object storage CSV
        ├── processProductImport()
        ├── processSoldKeysImport()
        └── processActiveKeysImport()

customer login
  └── POST /api/customer/auth/login           (routes/customer/auth/login.ts)
        └── authService.authenticateClient()  (services/auth.service.ts)
              └── verifyPassword()            (utils/passwordVerify.ts)
                    ├── bcrypt.compare()      ← modern hashes
                    └── verifyAspNetIdentityV3() ← legacy hashes (PBKDF2)
              └── if legacy → bcrypt.hash() + updateClientUserPassword()
```
