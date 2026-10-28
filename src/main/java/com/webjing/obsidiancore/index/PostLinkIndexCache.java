package com.webjing.obsidiancore.index;

import com.webjing.obsidiancore.service.PublicPostVisibility;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.router.selector.FieldSelector;

/**
 * <p>In-memory cache of published posts' {@code title -> (postName, permalink)} used for
 * resolving wikilinks and rendering. Lazily loaded, 5-minute TTL, invalidated by post
 * events.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostLinkIndexCache {

    private static final Duration TTL = Duration.ofMinutes(5);

    private final ReactiveExtensionClient client;

    private final Object lock = new Object();

    private volatile Map<String, PostTarget> byTitle = Map.of();

    private volatile Map<String, PostTarget> byLowerCaseTitle = Map.of();

    private volatile Map<String, PostTarget> byPostName = Map.of();

    private Set<String> publicPostNames = Set.of();

    private volatile Instant loadedAt = null;

    private volatile Mono<Void> loading = null;

    private long generation;

    /**
     * Target info of a resolvable post.
     */
    public record PostTarget(String postName, String title, String permalink) {
    }

    /**
     * Resolve a title to a published post. Matching is case-insensitive unless
     * {@code caseSensitive} is true.
     */
    public Mono<Optional<PostTarget>> resolve(String title, boolean caseSensitive) {
        return Mono.defer(this::ensureLoaded)
            .then(Mono.fromSupplier(() -> lookup(title, caseSensitive)));
    }

    /**
     * Resolve a post name (metadata.name) to a published post, used by
     * structured links inserted via the editor "文章关联" action.
     */
    public Mono<Optional<PostTarget>> resolveByName(String postName) {
        return Mono.defer(this::ensureLoaded)
            .then(Mono.fromSupplier(() -> lookupByName(postName)));
    }

    /**
     * Synchronous lookup against the currently loaded cache; call {@link #warmup()}
     * first. Matching is case-insensitive unless {@code caseSensitive} is true.
     */
    public Optional<PostTarget> lookup(String title, boolean caseSensitive) {
        if (title == null || title.isBlank()) {
            return Optional.empty();
        }
        if (caseSensitive) {
            return Optional.ofNullable(byTitle.get(title.strip()));
        }
        return Optional.ofNullable(byLowerCaseTitle.get(title.strip().toLowerCase(Locale.ROOT)));
    }

    /**
     * Synchronous post-name lookup against the currently loaded cache; call
     * {@link #warmup()} first.
     */
    public Optional<PostTarget> lookupByName(String postName) {
        if (postName == null || postName.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(byPostName.get(postName));
    }

    /** Theme rendering must not use the broader authenticated indexer's target set. */
    public Optional<PostTarget> lookupPublic(String title, boolean caseSensitive) {
        synchronized (lock) {
            return lookup(title, caseSensitive)
                .filter(target -> publicPostNames.contains(target.postName()));
        }
    }

    public Optional<PostTarget> lookupPublicByName(String postName) {
        synchronized (lock) {
            return lookupByName(postName)
                .filter(target -> publicPostNames.contains(target.postName()));
        }
    }

    /**
     * Invalidate the cache; next access reloads from the extension store.
     */
    public void invalidate() {
        synchronized (lock) {
            generation++;
            loadedAt = null;
            loading = null;
            byTitle = Map.of();
            byLowerCaseTitle = Map.of();
            byPostName = Map.of();
            publicPostNames = Set.of();
        }
    }

    /**
     * Make sure the cache is loaded (or reload it when stale) before synchronous
     * {@link #lookup(String, boolean)} calls, e.g. from the theme content handler.
     */
    public Mono<Void> warmup() {
        return Mono.defer(this::ensureLoaded);
    }

    private Mono<Void> ensureLoaded() {
        synchronized (lock) {
            if (loadedAt != null && Duration.between(loadedAt, Instant.now()).compareTo(TTL) < 0) {
                return Mono.empty();
            }
            if (loading != null) {
                return loading;
            }
            long version = generation;
            this.loading = load(version)
                .doOnSuccess(ignored -> {
                    synchronized (lock) {
                        if (generation == version) {
                            this.loadedAt = Instant.now();
                            this.loading = null;
                        }
                    }
                })
                .doOnError(e -> {
                    log.error("Failed to load post link index cache", e);
                    synchronized (lock) {
                        if (generation == version) {
                            this.loading = null;
                            byTitle = Map.of();
                            byLowerCaseTitle = Map.of();
                            byPostName = Map.of();
                            publicPostNames = Set.of();
                        }
                    }
                })
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .cache()
                // An invalidation during an in-flight load must not republish stale private data.
                .then(Mono.defer(() -> {
                    synchronized (lock) {
                        return generation == version ? Mono.empty() : ensureLoaded();
                    }
                }));
            return loading;
        }
    }

    private Mono<Void> load(long version) {
        return client.listAll(Post.class,
                new ListOptions().setFieldSelector(FieldSelector.all()),
                Sort.unsorted())
            .filter(post -> {
                var spec = post.getSpec();
                if (spec == null || post.getMetadata() == null || post.isDeleted()
                    || !Boolean.TRUE.equals(spec.getPublish())
                    || spec.getReleaseSnapshot() == null || spec.getReleaseSnapshot().isBlank()) {
                    return false;
                }
                var title = spec.getTitle();
                if (title == null || title.isBlank()) {
                    return false;
                }
                var permalink = post.getStatus() == null ? null : post.getStatus().getPermalink();
                return permalink != null && !permalink.isBlank();
            })
            .collectList()
            .doOnNext(posts -> {
                Map<String, PostTarget> byTitleMap = new HashMap<>(Math.max(16, posts.size() * 2));
                Map<String, PostTarget> lower = new HashMap<>(Math.max(16, posts.size() * 2));
                Map<String, PostTarget> byName = new HashMap<>(Math.max(16, posts.size() * 2));
                for (Post post : posts) {
                    var permalink = post.getStatus() == null
                        ? null : post.getStatus().getPermalink();
                    var target = new PostTarget(post.getMetadata().getName(),
                        post.getSpec().getTitle(), permalink);
                    String title = post.getSpec().getTitle().strip();
                    byTitleMap.put(title, target);
                    lower.put(title.toLowerCase(Locale.ROOT), target);
                    byName.put(post.getMetadata().getName(), target);
                }
                synchronized (lock) {
                    if (generation == version) {
                        this.byTitle = byTitleMap;
                        this.byLowerCaseTitle = lower;
                        this.byPostName = byName;
                        this.publicPostNames = posts.stream().filter(PublicPostVisibility::isVisible)
                            .map(post -> post.getMetadata().getName())
                            .collect(Collectors.toUnmodifiableSet());
                    }
                }
                log.debug("PostLinkIndexCache loaded {} posts", posts.size());
            })
            .onErrorMap(e -> {
                log.error("Failed to build post link index", e);
                return e;
            })
            .then();
    }
}
