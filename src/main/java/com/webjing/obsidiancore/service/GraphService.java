package com.webjing.obsidiancore.service;

import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import java.util.Set;
import reactor.core.publisher.Mono;

/**
 * <p>Assembles the knowledge graph payload: post nodes with wikilink edges, plus
 * category/tag hub nodes with taxonomy edges (posts link to their leaf category by
 * default and to all their tags). Broken (unresolved) links become pseudo nodes.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public interface GraphService {

    /**
     * Filters for graph assembly.
     */
    record GraphQuery(String keyword, Set<String> categories, Set<String> tags,
                      boolean showBroken, boolean includeDraft, boolean showTaxonomy,
                      boolean expandParents) {
    }

    /**
     * Public graph query with sub-graph modes.
     */
    record PublicGraphQuery(String mode, String post, Set<String> nodes, int depth,
                            boolean showBroken, boolean showTaxonomy) {
    }

    /**
     * Build the full knowledge graph for the Console, honoring keyword/category/tag filters.
     */
    Mono<GraphPayload> buildConsoleGraph(GraphQuery query);

    /**
     * Build the graph for anonymous theme-side rendering with full/local/nodes modes.
     */
    Mono<GraphPayload> buildPublicGraph(PublicGraphQuery query);
}
