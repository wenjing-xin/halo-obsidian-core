package com.webjing.obsidiancore.index;

import static run.halo.app.extension.index.query.QueryFactory.equal;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.index.WikiLinkParser.Occurrence;
import com.webjing.obsidiancore.model.LinkEntry;
import com.webjing.obsidiancore.model.WikiLink;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.content.ContentWrapper;
import run.halo.app.content.PostContentService;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.router.selector.FieldSelector;

/**
 * <p>Write-time indexer: builds and maintains one {@link WikiLink} per source post from
 * its release content. Also reconciles affected entries when titles or link targets
 * change.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WikiLinkIndexer {

    public static final String WIKILINK_NAME_PREFIX = "wikilink-";

    private final ReactiveExtensionClient client;

    private final PostContentService postContentService;

    private final PostLinkIndexCache linkCache;

    private final ObsidianSettings settings;

    public Mono<Void> indexPost(String postName) {
        return client.fetch(Post.class, postName)
            .flatMap(post -> {
                if (post.isDeleted() || isBlank(post.getSpec().getReleaseSnapshot())) {
                    return deletePost(postName);
                }
                return buildWikiLink(post)
                    .flatMap(this::upsert)
                    .doOnSuccess(link -> log.debug("Indexed wikilink of post {}", postName))
                    .then();
            })
            .switchIfEmpty(deletePost(postName))
            .onErrorResume(e -> {
                log.error("Failed to index wikilink of post {}", postName, e);
                return Mono.empty();
            });
    }

    public Mono<Void> deletePost(String postName) {
        String name = WIKILINK_NAME_PREFIX + postName;
        return client.fetch(WikiLink.class, name)
            .flatMap(client::delete)
            .doOnSuccess(ignored -> log.debug("Deleted wikilink of post {}", postName))
            .onErrorResume(e -> {
                log.error("Failed to delete wikilink of post {}", postName, e);
                return Mono.empty();
            })
            .then();
    }

    /**
     * Re-index every source post whose unresolved links can now resolve to the title,
     * e.g. after a new post with that title is published.
     */
    public Mono<Void> reconcileByTitle(String title) {
        if (title == null || title.isBlank()) {
            return Mono.empty();
        }
        return client.listAll(WikiLink.class,
                new ListOptions().setFieldSelector(
                    FieldSelector.of(equal(WikiLink.UNRESOLVED_TITLES_INDEX, title.strip()))),
                Sort.unsorted())
            .map(link -> link.getSpec().getSourcePostName())
            .distinct()
            .flatMap(this::indexPost)
            .then();
    }

    /**
     * Re-index every source post that currently links to the given target post, e.g.
     * after the target is deleted, renamed or unpublished.
     */
    public Mono<Void> reconcileByLinkedTarget(String postName) {
        if (postName == null || postName.isBlank()) {
            return Mono.empty();
        }
        return client.listAll(WikiLink.class,
                new ListOptions().setFieldSelector(
                    FieldSelector.of(equal(WikiLink.LINKED_TARGETS_INDEX, postName))),
                Sort.unsorted())
            .map(link -> link.getSpec().getSourcePostName())
            .distinct()
            .filter(sourceName -> !sourceName.equals(postName))
            .flatMap(this::indexPost)
            .then();
    }

    private WikiLink.WikiLinkSpec buildEmptySpec(Post post) {
        WikiLink.WikiLinkSpec spec = new WikiLink.WikiLinkSpec();
        spec.setSourcePostName(post.getMetadata().getName());
        spec.setSourceTitle(post.getSpec().getTitle());
        spec.setResolvedCount(0);
        spec.setUnresolvedCount(0);
        spec.setLinkedTargets(new LinkedHashSet<>());
        spec.setUnresolvedTitles(new LinkedHashSet<>());
        spec.setOutgoingLinks(List.of());
        spec.setUnresolvedLinks(List.of());
        spec.setIndexedAt(Instant.now());
        return spec;
    }

    private Mono<WikiLink> buildWikiLink(Post post) {
        String postName = post.getMetadata().getName();
        boolean caseSensitive = settings.isCaseSensitive();
        return postContentService.getReleaseContent(postName)
            .map(ContentWrapper::getRaw)
            .defaultIfEmpty("")
            .flatMap(raw -> {
                List<Occurrence> occurrences = WikiLinkParser.parse(raw);
                if (occurrences.isEmpty()) {
                    WikiLink link = new WikiLink();
                    link.setMetadata(newMetadata(postName));
                    link.setSpec(buildEmptySpec(post));
                    return Mono.just(link);
                }
                return Flux.fromIterable(occurrences)
                    .concatMap(occ -> resolveOccurrence(occ, caseSensitive)
                        .map(opt -> new ResolvedOccurrence(occ, opt)))
                    .collectList()
                    .map(resolved -> assemble(post, resolved));
            })
            .switchIfEmpty(Mono.fromSupplier(() -> {
                WikiLink link = new WikiLink();
                link.setMetadata(newMetadata(postName));
                link.setSpec(buildEmptySpec(post));
                return link;
            }));
    }

    private WikiLink assemble(Post post, List<ResolvedOccurrence> resolved) {
        List<LinkEntry> outgoingLinks = new ArrayList<>();
        List<LinkEntry> unresolvedLinks = new ArrayList<>();
        LinkedHashSet<String> linkedTargets = new LinkedHashSet<>();
        LinkedHashSet<String> unresolvedTitles = new LinkedHashSet<>();
        for (ResolvedOccurrence ro : resolved) {
            Occurrence occ = ro.occurrence();
            Optional<PostLinkIndexCache.PostTarget> targetOpt = ro.target();
            if (targetOpt.isPresent() && targetOpt.get().postName() != null) {
                var target = targetOpt.get();
                linkedTargets.add(target.postName());
                outgoingLinks.add(LinkEntry.builder()
                    .targetPostName(target.postName())
                    .targetTitle(target.title())
                    .alias(occ.alias())
                    .heading(occ.heading())
                    .snippet(occ.snippet())
                    .build());
            } else {
                unresolvedTitles.add(occ.target());
                unresolvedLinks.add(LinkEntry.builder()
                    .targetTitle(occ.target())
                    .alias(occ.alias())
                    .heading(occ.heading())
                    .snippet(occ.snippet())
                    .build());
            }
        }
        WikiLink link = new WikiLink();
        link.setMetadata(newMetadata(post.getMetadata().getName()));
        WikiLink.WikiLinkSpec spec = new WikiLink.WikiLinkSpec();
        spec.setSourcePostName(post.getMetadata().getName());
        spec.setSourceTitle(post.getSpec().getTitle());
        spec.setResolvedCount(outgoingLinks.size());
        spec.setUnresolvedCount(unresolvedLinks.size());
        spec.setLinkedTargets(linkedTargets);
        spec.setUnresolvedTitles(unresolvedTitles);
        spec.setOutgoingLinks(outgoingLinks);
        spec.setUnresolvedLinks(unresolvedLinks);
        spec.setIndexedAt(Instant.now());
        link.setSpec(spec);
        return link;
    }

    private Mono<WikiLink> upsert(WikiLink incoming) {
        String name = incoming.getMetadata().getName();
        return client.fetch(WikiLink.class, name)
            .flatMap(existing -> {
                incoming.getMetadata().setVersion(existing.getMetadata().getVersion());
                return client.update(incoming);
            })
            .switchIfEmpty(client.create(incoming));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private run.halo.app.extension.Metadata newMetadata(String postName) {
        run.halo.app.extension.Metadata metadata = new run.halo.app.extension.Metadata();
        metadata.setName(WIKILINK_NAME_PREFIX + postName);
        return metadata;
    }

    /**
     * Resolve an occurrence to a published target. Structured anchor links
     * carry a post name and resolve by name (title-independent); plain
     * {@code [[...]]} links resolve by title.
     */
    private Mono<Optional<PostLinkIndexCache.PostTarget>> resolveOccurrence(
            Occurrence occ, boolean caseSensitive) {
        if (occ.postName() != null && !occ.postName().isBlank()) {
            return linkCache.resolveByName(occ.postName());
        }
        return linkCache.resolve(occ.target(), caseSensitive);
    }

    private record ResolvedOccurrence(Occurrence occurrence,
                                      Optional<PostLinkIndexCache.PostTarget> target) {
    }
}
