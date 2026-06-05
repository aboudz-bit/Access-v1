---
name: orval generated query hooks require queryKey
description: Why call sites of generated React Query hooks in @workspace/api-client-react must pass queryKey
---

The codegen (orval) in `lib/api-client-react` types each generated query hook's
`options.query` as `UseQueryOptions<...>` (NOT `Partial<...>`), so `queryKey` is a
**required** field at every call site even though the generated `get*QueryOptions`
helper already defaults it via `queryOptions?.queryKey ?? get*QueryKey()`.

**Why:** Without the generated config emitting partial options, omitting `queryKey`
in a `{ query: { ... } }` block passes at runtime (vite/esbuild strip types) but
fails `tsc --noEmit` with TS2741.

**How to apply:** When using a generated hook with custom query options, always
include `queryKey: get<Name>QueryKey(...args)` (the key helper is exported from
`@workspace/api-client-react`). Example:
`useGetSession(id, { query: { queryKey: getGetSessionQueryKey(id), refetchInterval: 2000 } })`.
Run `pnpm --filter @workspace/access run typecheck` to catch missing keys —
the dev server will not.
