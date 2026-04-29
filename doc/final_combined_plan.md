# Final Combined Plan

## Source Evaluation Summary
- **DeepSeek + Perplexity** converged on the most practical architecture: **Cube (semantic/API) + Metabase (manual BI/UI) + thin orchestration**.
- **Copilot** aligns with the same core but over-weights DynamicJasper as a required core component.
- **GPT spec** is the most deterministic implementation template, but constrains stack choices (Java/Spring) and includes requirements beyond MVP.

## Decision
For a pragmatic MVP, proceed in phases:
1. **Phase 1 (implemented here):** local end-to-end reporting runtime with no AI dependency, strict query-model execution, CSV/table-friendly outputs, and reproducible tests.
2. **Phase 2:** add service APIs and persistent metadata store.
3. **Phase 3:** integrate Cube + Metabase adapters.
4. **Phase 4:** AI assistant as a validated JSON intent layer (BYOK).

## Why this path
- Preserves the common denominator across all council docs.
- Delivers immediate working software with minimal risk.
- Keeps architecture open for Cube/Metabase without blocking on heavy infra in MVP.

## MVP Deliverables in this repository
- In-memory database execution path.
- Structured report definition (select/aggregations/filters/group_by).
- End-to-end runner that produces markdown reports.
- Automated tests for query execution and report generation.

## Archived Inputs
All original council documents are moved to `archive/` for traceability.
