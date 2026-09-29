# Pattern: Cursor-Based Pagination

## When to Use
- Lists that may grow unbounded (e.g. audit logs, activity feeds)
- Real-time data where offset becomes inconsistent (rows inserted mid-page)
- Default for all list endpoints expected to exceed ~100 records

Use **offset pagination** only for: reports with fixed datasets, admin tables
where the UX explicitly requires numbered pages.

---

## Zod Schema (Single Source of Truth)
```typescript
// packages/validation/src/pagination.ts
import { z } from '@repo/validation'; // never import 'zod' directly

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional().openapi({ description: 'Opaque cursor from previous page' }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),                               // column name
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// For bidirectional pagination (e.g. audit log with forward/backward navigation)
export const BidirectionalCursorSchema = CursorPaginationSchema.extend({
  direction: z.enum(['forward', 'backward']).default('forward'),
});

// Response schema factory — use itemSchema from the feature's Zod schema
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),                        // 'data' is the standard list-envelope key
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    totalCount: z.number().int().optional(),          // expensive — only include if UX needs it
  });

export type CursorPaginationDto = z.infer<typeof CursorPaginationSchema>;
```

---

## Backend Implementation

### Repository / Service Query
```typescript
// Standard pattern: fetch one extra item to detect hasMore (no COUNT query)
async findMany(params: CursorPaginationDto & { orgId: string }) {
  const { cursor, limit, sortOrder, orgId } = params;

  const rows = await this.prisma.item.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: sortOrder },
    take: limit + 1,            // one extra to detect hasMore
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,                  // skip the cursor item itself
    }),
    select: { id: true, title: true, createdAt: true },
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return {
    data,
    nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
    hasMore,
  };
}
```

### Generic Utility (for bidirectional pagination)
```typescript
// apps/api/src/common/pagination/cursor.util.ts

// Opaque cursor encoding (base64url + prefix for debuggability)
export const encodeCursor = (id: string) =>
  Buffer.from(`cursor:${id}`).toString('base64url');

export const decodeCursor = (cursor: string) =>
  Buffer.from(cursor, 'base64url').toString().replace('cursor:', '');

export async function paginateWithCursor<T extends { id: string }>(
  findMany: (args: object) => Promise<T[]>,
  { cursor, limit, direction }: z.infer<typeof BidirectionalCursorSchema>,
): Promise<{ data: T[]; nextCursor: string | null; prevCursor: string | null; hasMore: boolean }> {
  const take = direction === 'forward' ? limit + 1 : -(limit + 1);
  const cursorArg = cursor
    ? { cursor: { id: decodeCursor(cursor) }, skip: 1 }
    : {};

  const rows = await findMany({ take, ...cursorArg, orderBy: { id: 'asc' } });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  if (direction === 'backward') rows.reverse();

  return {
    data: rows,
    nextCursor: hasMore && direction === 'forward' ? encodeCursor(rows.at(-1)!.id) : null,
    prevCursor: cursor && direction === 'forward' ? encodeCursor(rows[0].id) : null,
    hasMore,
  };
}
```

### Controller
```typescript
@Get()
@ApiOkResponse({ schema: zodToOpenAPI(PaginatedResponseSchema(ItemSchema)) })
async findAll(
  @Query() pagination: CursorPaginationDto,
  @CurrentUser() user: AuthUser,
): Promise<PaginatedResponse<ItemDto>> {
  return this.filesService.findMany({ ...pagination, orgId: user.orgId });
}
```

---

## Response Format
```json
{
  "data": [...],
  "nextCursor": "Y3Vyc29yOmNseDEyMzQ",
  "hasMore": true,
  "totalCount": 1547
}
```
`totalCount` is optional — omit when the table is large and a filtered COUNT is expensive.

---

## Frontend Consumption (orval-generated hooks)
```typescript
// "Load More" button — preferred over auto-scroll for accessibility
import { useInfiniteGetItems } from '@/hooks/generated';

function FileList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteGetItems(
      { limit: 20 },
      {
        query: {
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
          initialPageParam: undefined,
        },
      }
    );

  const files = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      {files.map((f) => <FileCard key={f.id} file={f} />)}
      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
          Load more
        </Button>
      )}
    </>
  );
}
```

> Never write `useInfiniteQuery` manually — always use the orval-generated
> `useInfinite*` hook. See `orval-codegen-pattern.md`.

---

## Rules
- Default limit: 20, max: 100 — enforced by Zod schema, never trust the caller
- Use `take: limit + 1` trick — avoids a separate `COUNT(*)` query
- Cursors must be opaque to the client — use `base64url(cursor:<id>)` encoding, never raw IDs
- Always return `hasMore` — required by the frontend infinite scroll / load-more pattern
- Always index the sort column: `@@index([createdAt])` minimum; add composite index for filtered queries (e.g. `@@index([orgId, createdAt])`)
- When filters change (search, phase, etc.) the client must reset the cursor to `undefined`
- `totalCount` is optional and expensive — include only when the UX requires it and the filtered index keeps the COUNT fast
- Prefer the "Load More" button pattern over auto-scroll infinite pagination for accessibility

## Token Optimization

**Load when** when implementing cursor pagination on list endpoints. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
