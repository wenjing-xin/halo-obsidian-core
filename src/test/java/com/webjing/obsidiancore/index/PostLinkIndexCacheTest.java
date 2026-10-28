package com.webjing.obsidiancore.index;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import java.time.Instant;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

@SuppressWarnings("unchecked")
class PostLinkIndexCacheTest {
    @Test
    void themeLookupExcludesPrivateDraftUnpublishedAndDeletingPostsButPreservesIndexTargets() {
        var client = mock(ReactiveExtensionClient.class);
        var publicPost = post("public");
        var privatePost = post("private");
        privatePost.getSpec().setVisible(Post.VisibleEnum.PRIVATE);
        var draft = post("draft");
        draft.getSpec().setReleaseSnapshot(null);
        var unpublished = post("unpublished");
        unpublished.getSpec().setPublish(false);
        var deleting = post("deleting");
        deleting.getMetadata().setDeletionTimestamp(Instant.now());
        when(client.listAll(eq(Post.class), any(), any()))
            .thenReturn(Flux.just(publicPost, privatePost, draft, unpublished, deleting));
        var cache = new PostLinkIndexCache(client);
        cache.warmup().block();
        assertThat(cache.lookupPublic("PUBLIC", false)).isPresent();
        assertThat(cache.lookupPublicByName("public")).isPresent();
        assertThat(cache.lookupByName("private")).isPresent();
        for (var name : java.util.List.of("private", "draft", "unpublished", "deleting")) {
            assertThat(cache.lookupPublic(name, false)).isEmpty();
            assertThat(cache.lookupPublicByName(name)).isEmpty();
        }
    }

    @Test
    void invalidationAndLoadFailuresNeverServePreviouslyPublicTargets() {
        var client = mock(ReactiveExtensionClient.class);
        when(client.listAll(eq(Post.class), any(), any()))
            .thenReturn(Flux.just(post("target")), Flux.error(new IllegalStateException("offline")),
                Flux.empty());
        var cache = new PostLinkIndexCache(client);
        cache.warmup().block();
        assertThat(cache.lookupPublicByName("target")).isPresent();
        cache.invalidate();
        assertThat(cache.lookupPublicByName("target")).isEmpty();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> cache.warmup().block())
            .isInstanceOf(IllegalStateException.class);
        assertThat(cache.lookupPublicByName("target")).isEmpty();
        cache.warmup().block();
        verify(client, times(3)).listAll(eq(Post.class), any(), any());
    }

    @Test
    void invalidationDuringLoadDiscardsOldPublicSnapshotAndRetries() {
        var client = mock(ReactiveExtensionClient.class);
        Sinks.One<Post> pending = Sinks.one();
        var subscribed = new java.util.concurrent.CountDownLatch(1);
        when(client.listAll(eq(Post.class), any(), any()))
            .thenReturn(pending.asMono().doOnSubscribe(ignored -> subscribed.countDown()).flux(), Flux.empty());
        var cache = new PostLinkIndexCache(client);
        var first = cache.warmup().toFuture();
        try {
            assertThat(subscribed.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            cache.invalidate();
            pending.tryEmitValue(post("formerly-public"));
            first.get(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
        assertThat(cache.lookupPublicByName("formerly-public")).isEmpty();
        verify(client, times(2)).listAll(eq(Post.class), any(), any());
    }

    private Post post(String name) {
        var post = new Post();
        post.setMetadata(new Metadata());
        post.getMetadata().setName(name);
        post.setSpec(new Post.PostSpec());
        post.getSpec().setTitle(name);
        post.getSpec().setPublish(true);
        post.getSpec().setVisible(Post.VisibleEnum.PUBLIC);
        post.getSpec().setReleaseSnapshot("release");
        post.setStatus(new Post.PostStatus());
        post.getStatus().setPermalink("/" + name);
        return post;
    }

    @Test
    void firstTitleAndNameQueriesWaitForCacheWarmup() {
        var client = mock(ReactiveExtensionClient.class);
        var post = new Post();
        post.setMetadata(new Metadata());
        post.getMetadata().setName("target");
        post.setSpec(new Post.PostSpec());
        post.getSpec().setTitle("Target");
        post.getSpec().setPublish(true);
        post.getSpec().setVisible(Post.VisibleEnum.PUBLIC);
        post.getSpec().setReleaseSnapshot("release");
        post.setStatus(new Post.PostStatus());
        post.getStatus().setPermalink("/target");
        when(client.listAll(eq(Post.class), any(), any())).thenReturn(Flux.just(post));
        assertThat(new PostLinkIndexCache(client).resolve(" target ", false).block())
            .hasValueSatisfying(target -> assertThat(target.postName()).isEqualTo("target"));
        assertThat(new PostLinkIndexCache(client).resolveByName("target").block())
            .hasValueSatisfying(target -> assertThat(target.permalink()).isEqualTo("/target"));
    }
}
