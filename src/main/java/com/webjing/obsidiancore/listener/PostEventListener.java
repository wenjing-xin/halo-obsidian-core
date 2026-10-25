package com.webjing.obsidiancore.listener;

import com.webjing.obsidiancore.index.PostLinkIndexCache;
import com.webjing.obsidiancore.index.WikiLinkIndexer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.app.core.extension.content.Post;
import run.halo.app.event.post.PostDeletedEvent;
import run.halo.app.event.post.PostPublishedEvent;
import run.halo.app.event.post.PostUnpublishedEvent;
import run.halo.app.event.post.PostUpdatedEvent;
import run.halo.app.event.post.PostVisibleChangedEvent;
import run.halo.app.extension.ReactiveExtensionClient;

/**
 * <p>Listener for post lifecycle events that keeps wikilink indexes in sync. Work is
 * dispatched asynchronously on boundedElastic and never blocks the event thread.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostEventListener {

    private final WikiLinkIndexer indexer;

    private final PostLinkIndexCache linkCache;

    private final ReactiveExtensionClient client;

    @EventListener
    public void onPostUpdated(PostUpdatedEvent event) {
        onPostContentChanged(event.getName()).subscribe();
    }

    @EventListener
    public void onPostPublished(PostPublishedEvent event) {
        onPostContentChanged(event.getName()).subscribe();
    }

    @EventListener
    public void onPostUnpublished(PostUnpublishedEvent event) {
        onPostRemoved(event.getName()).subscribe();
    }

    @EventListener
    public void onPostDeleted(PostDeletedEvent event) {
        onPostRemoved(event.getName()).subscribe();
    }

    @EventListener
    public void onPostVisibleChanged(PostVisibleChangedEvent event) {
        onPostContentChanged(event.getName()).subscribe();
    }

    private Mono<Void> onPostContentChanged(String postName) {
        linkCache.invalidate();
        return client.fetch(Post.class, postName)
            .map(post -> post.getSpec().getTitle())
            .defaultIfEmpty("")
            .flatMap(title -> indexer.indexPost(postName)
                .then(indexer.reconcileByLinkedTarget(postName))
                .then(indexer.reconcileByTitle(title)))
            .onErrorResume(e -> {
                log.error("Failed to reconcile wikilinks for post {}", postName, e);
                return Mono.empty();
            })
            .subscribeOn(Schedulers.boundedElastic());
    }

    private Mono<Void> onPostRemoved(String postName) {
        linkCache.invalidate();
        return indexer.deletePost(postName)
            .then(indexer.reconcileByLinkedTarget(postName))
            .onErrorResume(e -> {
                log.error("Failed to reconcile wikilinks after removing post {}", postName, e);
                return Mono.empty();
            })
            .subscribeOn(Schedulers.boundedElastic());
    }
}
