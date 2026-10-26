package com.webjing.obsidiancore.index;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class PostLinkIndexCacheTest {
    @Test
    void firstTitleAndNameQueriesWaitForCacheWarmup() {
        var client = mock(ReactiveExtensionClient.class);
        var post = new Post();
        post.setMetadata(new Metadata());
        post.getMetadata().setName("target");
        post.setSpec(new Post.PostSpec());
        post.getSpec().setTitle("Target");
        post.getSpec().setPublish(true);
        post.setStatus(new Post.PostStatus());
        post.getStatus().setPermalink("/target");
        when(client.listAll(eq(Post.class), any(), any())).thenReturn(Flux.just(post));
        assertThat(new PostLinkIndexCache(client).resolve(" target ", false).block())
            .hasValueSatisfying(target -> assertThat(target.postName()).isEqualTo("target"));
        assertThat(new PostLinkIndexCache(client).resolveByName("target").block())
            .hasValueSatisfying(target -> assertThat(target.permalink()).isEqualTo("/target"));
    }
}
