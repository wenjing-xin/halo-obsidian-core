package com.webjing.obsidiancore.index;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.model.WikiLink;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import reactor.core.publisher.Mono;
import run.halo.app.content.ContentWrapper;
import run.halo.app.content.PostContentService;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class WikiLinkIndexerTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final PostContentService content = mock(PostContentService.class);
    private final PostLinkIndexCache cache = mock(PostLinkIndexCache.class);
    private final WikiLinkIndexer indexer = new WikiLinkIndexer(client, content, cache,
        new ObsidianSettings());
    private Post post;

    @BeforeEach
    void setup() {
        post = new Post();
        var metadata = new Metadata();
        metadata.setName("source");
        post.setMetadata(metadata);
        var spec = new Post.PostSpec();
        spec.setTitle("Source");
        spec.setPublish(true);
        spec.setDeleted(false);
        spec.setReleaseSnapshot("released");
        post.setSpec(spec);
        when(client.fetch(Post.class, "source")).thenReturn(Mono.just(post));
    }

    @Test
    void createdIndexMustSurviveSuccessfulCompletion() {
        when(content.getReleaseContent("source")).thenReturn(Mono.just(
            ContentWrapper.builder().raw("[[Target]]").build()));
        when(cache.resolve("Target", false)).thenReturn(Mono.just(Optional.of(
            new PostLinkIndexCache.PostTarget("target", "Target", "/target"))));
        when(client.fetch(WikiLink.class, "wikilink-source")).thenReturn(Mono.empty());
        when(client.create(any(WikiLink.class))).thenAnswer(call -> Mono.just(call.getArgument(0)));

        indexer.indexPost("source").block();

        var saved = ArgumentCaptor.forClass(WikiLink.class);
        verify(client).create(saved.capture());
        assertThat(saved.getValue().getSpec().getLinkedTargets()).containsExactly("target");
        assertThat(saved.getValue().getSpec().getResolvedCount()).isEqualTo(1);
        verify(client, never()).delete(any());
    }

    @Test
    void updatedStructuredLinkMustKeepItsVersionAndNotCreateOrDelete() {
        when(content.getReleaseContent("source")).thenReturn(Mono.just(ContentWrapper.builder()
            .raw("<p><obsidian-core-link post=\"target\" url=\"/old\">Old title</obsidian-core-link></p>").build()));
        when(cache.resolveByName("target")).thenReturn(Mono.just(Optional.of(
            new PostLinkIndexCache.PostTarget("target", "New title", "/new"))));
        WikiLink existing = new WikiLink();
        existing.setMetadata(new Metadata());
        existing.getMetadata().setVersion(4L);
        when(client.fetch(WikiLink.class, "wikilink-source")).thenReturn(Mono.just(existing));
        when(client.update(any(WikiLink.class))).thenAnswer(call -> Mono.just(call.getArgument(0)));
        indexer.indexPost("source").block();
        var saved = ArgumentCaptor.forClass(WikiLink.class);
        verify(client).update(saved.capture());
        assertThat(saved.getValue().getMetadata().getVersion()).isEqualTo(4L);
        assertThat(saved.getValue().getSpec().getOutgoingLinks().getFirst().getTargetTitle())
            .isEqualTo("New title");
        verify(client, never()).create(any());
        verify(client, never()).delete(any());
    }

    @Test
    void absentPostDeletesStaleIndex() {
        when(client.fetch(Post.class, "source")).thenReturn(Mono.empty());
        var existing = new WikiLink();
        when(client.fetch(WikiLink.class, "wikilink-source")).thenReturn(Mono.just(existing));
        when(client.delete(existing)).thenReturn(Mono.just(existing));
        indexer.indexPost("source").block();
        verify(client).delete(existing);
        verifyNoInteractions(content);
    }

    @Test
    void unpublishedPostDoesNotRecreateIndexFromOldReleaseSnapshot() {
        post.getSpec().setPublish(false);
        when(client.fetch(WikiLink.class, "wikilink-source")).thenReturn(Mono.empty());
        indexer.indexPost("source").block();
        verifyNoInteractions(content);
        verify(client, never()).create(any());
    }
}
