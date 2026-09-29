# OpenSearch Derived-Index Pattern (Phase 2+)

> **Lean reference.** OpenSearch is a **Phase-2+** capability, not a Phase-1
> component. Phase-1 search is **Postgres-only** (GIN + B-tree). Load this only
> when planning or building the Phase-2+ search increment. Anchored to
> [strategy §4.3](../../specs/strategy/04-source-strategy-reconciliation.md) and
> [fs/10 FS-10-PERF-02](../../specs/fs/10-nfr-security-observability.md).

## The one rule that governs everything

**Postgres is the single system of record in every phase.** OpenSearch is a
**derived, rebuildable index — never a second source of truth.** If the index is
lost, it is rebuilt from Postgres. No value is authoritative in OpenSearch.

## When it is (and is not) used

| Phase | Search realisation |
| --- | --- |
| **Phase 1** | **Postgres only.** Promoted, B-tree/GIN-indexed columns serve filtered/sorted/joined queries; reporting reads never scan JSONB for a filtered value (indexing contract — [FS/07 §6](../../specs/fs/07-data-model.md)). **No OpenSearch.** |
| **Phase 2+** | Free-text and faceted search over heterogeneous agreement data moves to a CDC-fed OpenSearch index. Structured/exact/range queries and must-be-correct values **stay in Postgres**. |

Do **not** stand up OpenSearch to serve a Phase-1 structured filter — Postgres
GIN/B-tree is sufficient and correct. Reaching for OpenSearch early couples the
build to a data model still stabilising.

## Shape (when built)

- **Feed:** CDC (DMS/Debezium) off Postgres change events → indexer → OpenSearch.
  Never dual-write from the application.
- **Mapping:** a `flat_object` `attrs` field absorbs the 100+ document-type
  heterogeneity without a mapping explosion. Promoted scalars mirror the
  Postgres relational core for facet/sort.
- **Safe reindex:** index behind an **alias**; on a mapping change, build the new
  index, then **atomically swap** the alias. No downtime, no partial state.
- **Federated query:** OpenSearch answers free-text/facets; Postgres answers
  exposure/dates/events/authoritative values; results are **merged by id**.
  Never let a federated read treat the OpenSearch copy as authoritative.

## Non-negotiables

- Derived and rebuildable — **never** a second SoR.
- CDC-fed — never application dual-write.
- Alias + atomic swap on every mapping change.
- Region-pinned `ap-southeast-2`; DirectConnect only; no public endpoints
  ([ADR-0003](../../specs/adr/adr-0003-aws-over-on-prem.md)).
- Heavy search/reporting reads are **isolated from the interactive path**
  (NF-015) — a search load spike must not degrade election-form latency.

## Cross-References

- Search reconciliation + phasing:
  [strategy §4.3](../../specs/strategy/04-source-strategy-reconciliation.md).
- Indexing contract (Postgres, Phase 1):
  [FS/07 §6](../../specs/fs/07-data-model.md),
  [fs/10 FS-10-PERF-02](../../specs/fs/10-nfr-security-observability.md).
- SoR guarantee across phases:
  [strategy §2.3](../../specs/strategy/02-architecture-overview.md).

## Token Optimization

**Load when** planning or building the Phase-2+ search increment. **Do not load**
for any Phase-1 search work — that is Postgres-only. **Unload after** the search
increment design is captured.
