package com.webjing.obsidiancore.service;

import com.webjing.obsidiancore.dto.GraphModels.BacklinksResult;
import com.webjing.obsidiancore.dto.GraphModels.GraphSummary;
import com.webjing.obsidiancore.dto.GraphModels.UnresolvedItem;
import com.webjing.obsidiancore.model.WikiLink;
import java.util.List;
import reactor.core.publisher.Mono;

/**
 * <p>Backlink / outgoing / unresolved-link queries over the WikiLink index.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public interface BacklinkService {

    /**
     * Posts that link to the given target post, via the spec.linkedTargets index.
     */
    Mono<BacklinksResult> backlinks(String postName);

    /**
     * All outgoing links (resolved and unresolved) of one post.
     */
    Mono<WikiLink> outgoing(String postName);

    /**
     * All unresolved (broken) links across the site.
     */
    Mono<List<UnresolvedItem>> unresolved();

    /**
     * Aggregate summary of the wikilink index plus reindex progress.
     */
    Mono<GraphSummary> summary();
}
