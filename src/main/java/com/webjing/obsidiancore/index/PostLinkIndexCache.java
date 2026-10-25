package com.webjing.obsidiancore.index;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
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

    private volatile Instant loadedAt = null;

    private volatile Mono<Void> loading = null;

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
        return ensureLoaded().thenReturn(lookup(title, caseSensitive));
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
            return Optional.ofNullable(byTitle.get(title));
        }
        return Optional.ofNullable(byLowerCaseTitle.get(title.toLowerCase(Locale.ROOT)));
    }

    /**
     * Invalidate the cache; next access reloads from the extension store.
     */
    public void invalidate() {
        synchronized (lock) {
            loadedAt = null;
        }
    }

    /**
     * Make sure the cache is loaded (or reload it when stale) before synchronous
     * {@link #lookup(String, boolean)} calls, e.g. from the theme content handler.
     */
    public Mono<Void> warmup() {
        return ensureLoaded();
    }

    private Mono<Void> ensureLoaded() {
        synchronized (lock) {
            if (loadedAt != null && Duration.between(loadedAt, Instant.now()).compareTo(TTL) < 0) {
                return Mono.empty();
            }
            if (loading != null) {
                return loading;
            }
            this.loading = load()
                .doOnSuccess(ignored -> {
                    synchronized (lock) {
                        this.loadedAt = Instant.now();
                        this.loading = null;
                    }
                })
                .onErrorResume(e -> {
                    log.error("Failed to load post link index cache", e);
                    synchronized (lock) {
                        this.loading = null;
                    }
                    return Mono.empty();
                })
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .then();
            return loading;
        }
    }

    private Mono<Void> load() {
        return client.listAll(Post.class,
                new ListOptions().setFieldSelector(FieldSelector.all()),
                Sort.unsorted())
            .filter(post -> {
                var spec = post.getSpec();
                if (spec == null || Boolean.TRUE.equals(spec.getDeleted())
                    || !Boolean.TRUE.equals(spec.getPublish())) {
                    return false;
                }
                var title = spec.getTitle();
                if (title == null || title.isBlank()) {
                    return false;
                }
                var permalink = post.getStatus() == null ? null : post.getStatus().getPermalink();
                return permalink != null && !permalink.isBlank();
            })
            .collectMap(post -> post.getSpec().getTitle().strip(), post -> {
                var permalink = post.getStatus() == null ? null : post.getStatus().getPermalink();
                return new PostTarget(post.getMetadata().getName(),
                    post.getSpec().getTitle(), permalink);
            })
            .doOnNext(map -> {
                Map<String, PostTarget> lower = new HashMap<>(Math.max(16, map.size() * 2));
                map.forEach((title, target) ->
                    lower.put(title.toLowerCase(Locale.ROOT), target));
                synchronized (lock) {
                    this.byTitle = map;
                    this.byLowerCaseTitle = lower;
                }
                log.debug("PostLinkIndexCache loaded {} posts", map.size());
            })
            .onErrorMap(e -> {
                log.error("Failed to build post link index", e);
                return e;
            })
            .then();
    }
}
