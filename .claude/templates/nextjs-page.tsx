/**
 * {Entity} List Page — Server Component (default)
 *
 * Route: /app/(protected)/{resources}/page.tsx
 * Auth: Protected by PingID middleware (middleware.ts)
 * Read @.claude/xxxx/component-library.md before modifying UI components.
 * Query design system MCP (if configured) for component APIs and Context7 MCP for framework patterns when needed.
 */

import type { Metadata } from 'next';
import type { SearchParams } from '@/types/common';
import { { Entity }ListContainer } from '@/components/{resources}/{Entity}ListContainer';
import { get{ Entities } } from '@/services/{resource}.service';
import { { Entity }ListSchema } from '@/types/{resource}';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
    title: '{Entities} | PPCC App',
    description: 'Manage {entities}',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface { Entity }PageProps {
    searchParams: SearchParams;
}

// ─── Page (RSC — no 'use client') ─────────────────────────────────────────────

export default async function { Entity } Page({ searchParams }: { Entity }PageProps) {
    // Server-side data fetch — runs on server, not in browser
    // Errors bubble up to error.tsx error boundary
    const data = await get{ Entities }({
        page: Number(searchParams.page ?? 0),
        size: Number(searchParams.size ?? 20),
        sortBy: searchParams.sortBy as string ?? 'createdAt',
        sortDir: (searchParams.sortDir as 'asc' | 'desc') ?? 'desc',
        status: searchParams.status as string | undefined,
    });

    return (
        <main id="main-content" aria-label="{Entity} management">
            {/* Pass server-fetched data as initial data to client container */}
            <{Entity} ListContainer initialData={data} searchParams={searchParams} />
        </main>
    );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Save as: app/(protected)/{resources}/error.tsx

// 'use client';
//
// import { useEffect } from 'react';
// // Query design system MCP: "error state component"
// import { ErrorState } from '@your-ui-lib/react';
//
// export default function {Entity}Error({
//   error,
//   reset,
// }: {
//   error: Error & { digest?: string };
//   reset: () => void;
// }) {
//   useEffect(() => {
//     // Log to observability platform
//     console.error('Page error:', error);
//   }, [error]);
//
//   return (
//     <ErrorState
//       title="Unable to load {entities}"
//       description="Please try again or contact support."
//       action={{ label: 'Try again', onClick: reset }}
//     />
//   );
// }

// ─── Loading State ────────────────────────────────────────────────────────────
// Save as: app/(protected)/{resources}/loading.tsx

// // Query design system MCP: "skeleton loading component"
// import { PageSkeleton } from '@your-ui-lib/react';
//
// export default function {Entity}Loading() {
//   return <PageSkeleton rows={5} />;
// }
