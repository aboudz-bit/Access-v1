---
name: drizzle wraps pg errors (cause)
description: Where to find the Postgres SQLSTATE code when catching errors from drizzle-orm node-postgres queries
---

When a drizzle-orm (node-postgres) query throws, the Postgres error (with its
SQLSTATE `code`, e.g. `23505` for unique_violation) is NOT on the top-level
thrown error. drizzle wraps it, so the original pg error is on `err.cause`.

**Why:** Checking only `err.code` makes unique/constraint handlers silently miss,
falling through to the global 500 handler instead of returning a clean 409/422.
Observed with duplicate inserts returning 500 until `err.cause.code` was checked.

**How to apply:** When detecting constraint violations, check BOTH `err.code` and
`err.cause.code`. Example helper: treat as unique violation if either equals
`"23505"`.
