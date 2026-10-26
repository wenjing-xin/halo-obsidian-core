# obsidian-core Development Guide

## Source of truth

- Read `.trae/documents/obsidian-core-plugin-dev-plan.md` before changing scope or architecture. It defines Halo wikilinks, backlink/broken-link management, the shared knowledge graph, and editor/theme integration.
- Target Java 21 and Halo 2.27.0 (`plugin.yaml`: `>=2.27.0`). Verify version-sensitive signatures against installed dependencies. Do not use Halo 2.28-only APIs or raise requirements silently.
- The current renderer uses Sigma/Graphology/ForceAtlas2, although the original plan proposed d3-force/Canvas. Preserve the shared renderer interface unless a deliberate migration is requested. Do not claim Obsidian uses this implementation.
- Visual reference: https://obsidian.md/zh/help/plugins/graph. Match its flat circular nodes, restrained links, connected-node sizing, neighbor highlighting, navigation, and settings. Do not substitute glossy 3D spheres or claim pixel-perfect equivalence without visual verification.

## Architecture and discovery

- Prefer codebase-memory MCP `search_graph`, `trace_path`, `get_code_snippet`, and `query_graph` for code discovery. Use `rg` for literals/configuration or when the graph is incomplete.
- Keep modules cohesive and single-purpose. Share behavior through explicit, importable interfaces; avoid duplicated rendering, hidden cross-module state, and catch-all helpers.
- Backend package: `src/main/java/com/webjing/obsidiancore/`. Keep parsing/indexing in `index/`, lifecycle orchestration in `listener/`, graph/backlink assembly in `service/impl/`, transport in `endpoint/`, settings in `config/`, and theme hooks in `theme/`.
- Console: `ui/src/views/` and `components/`; editor extensions: `ui/src/editor/`; shared rendering/types: `ui/src/shared/graph-renderer/`; Lit web component: `ui/widget/src/`.
- Console and theme must consume the same rendering core. Keep Lit out of the Console bundle. Preserve the existing Vite/Rslib and Gradle build integration.

## Wikilink invariants

- Maintain one `WikiLink` per source post, named `wikilink-<postName>`, from published release content. Index both Markdown/HTML `[[title]]`, aliases/headings, and structured editor anchors with their stable post names.
- Skip code, comments, scripts/styles and ordinary anchors. Escape output and do not corrupt surrounding HTML.
- Resolve targets using eligible published posts; backlink queries use the multi-value `spec.linkedTargets` index. Changes to titles, publication, visibility and deletion must invalidate caches and reconcile affected links.
- Never put destructive `switchIfEmpty` fallback after a `Mono<Void>`/`then()` success path: completion without a value is not absence of a post. Keep fallback writes lazy and test both create and update paths.
- Keep WebFlux paths non-blocking, surface failures, and use lifecycle/reindex recovery rather than silent data loss.

## Graph and editor contract

- Support `full` (global), `local` (current article or explicit center, bounded depth), and `nodes` (selected article subgraph). Ask for scope as part of insertion and allow later reconfiguration.
- Resolve implicit current-article context on the server when rendering article content; never guess an article from its URL or silently fall back to the global graph.
- Preserve post/category/tag node identities, wikilink direction, taxonomy links, leaf-category rules, exclusions and graph limits. Taxonomy hubs must not make unrelated articles wiki neighbors in a local graph.
- Theme components default to automatic theme following, with explicit light/dark overrides. Observe theme changes, honor CSS variables and clean up observers/listeners/workers on disconnect.
- Follow `.trae/example/plugin-comment-widget-main` for theme conventions. Keep legacy serialized attributes compatible.

## Security and UI

- Public graph APIs are read-only, require `allowAnonymousGraph`, and expose only published PUBLIC, non-deleted articles. Configuration failures must fail closed. Never broaden anonymous permissions for convenience.
- Use Halo components, shared stores/utils and FormKit before custom equivalents; use the existing `axiosInstance` API wrapper.
- Use `VPageHeader`, `VCard` header/footer slots, explicit loading/error/empty states and responsive layouts. The backlink management page has an outer `md:m-4` margin and distinct responsive statistic cards.
- Do not hand-edit generated API clients, built bundles or packaged resources. Change source and rebuild. Do not commit credentials, local fixture data or unrelated changes.

## Verification and delivery

- Backend: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew test` (use `-x processUiResources` for focused backend iterations).
- Frontend (Node >=22.12, pnpm 10): `cd ui && pnpm type-check`, `pnpm test:unit --run`, and `pnpm build` (includes widget type checking/build).
- Packaging: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew build`; inspect that the JAR includes Console and widget assets. DevTools uses port 8098, not the plan's illustrative 8090.
- Add regression coverage for successful indexes surviving, reciprocal backlink lookup, structured/plain links, local/nodes scoping, theme precedence/live changes, and shared graph interactions.
- Smoke-test available runtime paths: publish A linking to B, query B backlinks, rename/unpublish/delete B, reindex, insert all three graph modes, switch light/dark without reload, and verify anonymous 403 when disabled.
- Run `git diff --check`, review the changed files, and report exact checks run plus unverified runtime/visual behavior. Preserve user edits; do not deploy, commit or push without authorization.
