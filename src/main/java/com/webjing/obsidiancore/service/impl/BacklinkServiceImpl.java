package com.webjing.obsidiancore.service.impl;

import static run.halo.app.extension.index.query.Queries.equal;

import com.webjing.obsidiancore.dto.GraphModels.BacklinkItem;
import com.webjing.obsidiancore.dto.GraphModels.BacklinksResult;
import com.webjing.obsidiancore.dto.GraphModels.GraphSummary;
import com.webjing.obsidiancore.dto.GraphModels.UnresolvedItem;
import com.webjing.obsidiancore.index.WikiLinkIndexer;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.BacklinkService;
import com.webjing.obsidiancore.service.ReindexService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;

/**
 * <p>Default implementation of {@link BacklinkService} querying the WikiLink index.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
@RequiredArgsConstructor
public class BacklinkServiceImpl implements BacklinkService {

    private final ReactiveExtensionClient client;

    private final ReindexService reindexService;

    @Override
    public Mono<BacklinksResult> backlinks(String postName) {
        return client.listAll(WikiLink.class,
                ListOptions.builder().andQuery(equal(WikiLink.LINKED_TARGETS_INDEX, postName))
                    .build(), Sort.unsorted())
            .flatMap(link -> client.fetch(Post.class, link.getSpec().getSourcePostName())
                .map(post -> {
                    String permalink = post.getStatus() == null
                        ? null : post.getStatus().getPermalink();
                    return new BacklinkItem(link.getSpec().getSourcePostName(),
                        link.getSpec().getSourceTitle(), permalink,
                        snippetFor(link, postName));
                }))
            .collectList()
            .map(items -> new BacklinksResult(items, items.size()));
    }

    private String snippetFor(WikiLink link, String postName) {
        if (link.getSpec().getOutgoingLinks() == null) {
            return "";
        }
        return link.getSpec().getOutgoingLinks().stream()
            .filter(entry -> postName.equals(entry.getTargetPostName()))
            .map(entry -> entry.getSnippet() == null ? "" : entry.getSnippet())
            .findFirst()
            .orElse("");
    }

    @Override
    public Mono<WikiLink> outgoing(String postName) {
        return client.fetch(WikiLink.class, WikiLinkIndexer.WIKILINK_NAME_PREFIX + postName);
    }

    @Override
    public Mono<List<UnresolvedItem>> unresolved() {
        return client.listAll(WikiLink.class, options(), Sort.unsorted())
            .flatMap(link -> {
                List<UnresolvedItem> items = new ArrayList<>();
                if (link.getSpec() == null || link.getSpec().getUnresolvedLinks() == null) {
                    return Mono.just(items);
                }
                for (var entry : link.getSpec().getUnresolvedLinks()) {
                    items.add(new UnresolvedItem(link.getSpec().getSourcePostName(),
                        link.getSpec().getSourceTitle(), entry.getTargetTitle(),
                        entry.getSnippet() == null ? "" : entry.getSnippet()));
                }
                return Mono.just(items);
            })
            .collectList()
            .map(lists -> lists.stream().flatMap(List::stream).toList());
    }

    @Override
    public Mono<GraphSummary> summary() {
        return client.listAll(WikiLink.class, options(), Sort.unsorted())
            .reduce(new Object[] {0, 0, 0, null}, (acc, link) -> {
                acc[0] = (int) acc[0] + 1;
                int resolved = link.getSpec() == null || link.getSpec().getResolvedCount() == null
                    ? 0 : link.getSpec().getResolvedCount();
                int unresolved =
                    link.getSpec() == null || link.getSpec().getUnresolvedCount() == null
                        ? 0 : link.getSpec().getUnresolvedCount();
                acc[1] = (int) acc[1] + resolved;
                acc[2] = (int) acc[2] + unresolved;
                Instant indexedAt =
                    link.getSpec() == null ? null : link.getSpec().getIndexedAt();
                if (indexedAt != null && ((Instant) acc[3] == null
                    || indexedAt.isAfter((Instant) acc[3]))) {
                    acc[3] = indexedAt;
                }
                return acc;
            })
            .map(acc -> new GraphSummary((int) acc[0], (int) acc[1], (int) acc[2],
                acc[3] == null ? null : acc[3].toString(),
                reindexService.progress().running(), reindexService.progress().processed(),
                reindexService.progress().total()));
    }

    private ListOptions options() {
        return ListOptions.builder().build();
    }
}
