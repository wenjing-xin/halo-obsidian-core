package com.webjing.obsidiancore.service.impl;

import com.webjing.obsidiancore.index.PostLinkIndexCache;
import com.webjing.obsidiancore.index.WikiLinkIndexer;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.ReindexService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.router.selector.FieldSelector;

/**
 * <p>Default implementation of {@link ReindexService} rebuilding all WikiLink entries.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReindexServiceImpl implements ReindexService {

    private final ReactiveExtensionClient client;

    private final WikiLinkIndexer indexer;

    private final PostLinkIndexCache linkCache;

    private final AtomicBoolean reindexing = new AtomicBoolean(false);

    private final AtomicInteger total = new AtomicInteger(0);

    private final AtomicInteger processed = new AtomicInteger(0);

    @Override
    public Mono<Boolean> reindexAll() {
        if (!reindexing.compareAndSet(false, true)) {
            return Mono.just(false);
        }
        total.set(0);
        processed.set(0);
        return listPosts()
            .collectList()
            .flatMap(posts -> {
                total.set(posts.size());
                log.info("Full wikilink re-index started for {} posts", posts.size());
                return Flux.fromIterable(posts)
                    .concatMap(post -> indexer.indexPost(post.getMetadata().getName())
                        .doOnSuccess(ignored -> processed.incrementAndGet()))
                    .then();
            })
            .doFinally(signal -> {
                reindexing.set(false);
                linkCache.invalidate();
                log.info("Full wikilink re-index finished: {}/{}", processed.get(), total.get());
            })
            .onErrorResume(e -> {
                log.error("Full wikilink re-index failed", e);
                return Mono.empty();
            })
            .subscribeOn(Schedulers.boundedElastic())
            .thenReturn(true);
    }

    @Override
    public ReindexProgress progress() {
        return new ReindexProgress(reindexing.get(), processed.get(), total.get());
    }

    private Flux<Post> listPosts() {
        return client.listAll(Post.class,
                new ListOptions().setFieldSelector(FieldSelector.all()), Sort.unsorted())
            .filter(post -> {
                var spec = post.getSpec();
                if (spec == null || post.isDeleted()) {
                    return false;
                }
                return spec.getReleaseSnapshot() != null
                    && !spec.getReleaseSnapshot().isBlank();
            });
    }

    @Override
    public Mono<Void> removeStaleEntries() {
        return client.listAll(WikiLink.class,
                new ListOptions().setFieldSelector(FieldSelector.all()), Sort.unsorted())
            .map(link -> link.getSpec().getSourcePostName())
            .distinct()
            .collectList()
            .flatMap(sourceNames -> Flux.fromIterable(sourceNames)
                .flatMap(name -> client.fetch(Post.class, name)
                    .switchIfEmpty(Mono.defer(() ->
                        indexer.deletePost(name).then(Mono.empty()))))
                .then());
    }
}
