package com.webjing.obsidiancore.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.index.PostLinkIndexCache;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.content.Post;
import run.halo.app.extension.Metadata;
import run.halo.app.theme.ReactivePostContentHandler.PostContentContext;

class ObsidianPostContentHandlerTest {
    @Test
    void newTagRendersAfterWarmupWithoutGraphOrLegacySyntaxEnabled() {
        var cache = mock(PostLinkIndexCache.class);
        var loaded = new AtomicBoolean();
        when(cache.warmup()).thenReturn(Mono.fromRunnable(() -> loaded.set(true)));
        when(cache.lookupByName("p1")).thenAnswer(call -> loaded.get()
            ? Optional.of(new PostLinkIndexCache.PostTarget("p1", "Renamed", "/current"))
            : Optional.empty());
        var settings = new ObsidianSettings();
        settings.setRenderWikilinks(false);
        settings.setAllowAnonymousGraph(false);
        var handler = new ObsidianPostContentHandler(cache, settings);
        var context = PostContentContext.builder().content(
            "<p><obsidian-core-link post=\"p1\" url=\"/old\" title=\"Article\">Alias</obsidian-core-link></p>").build();
        String result = handler.handle(context).block().getContent();
        assertThat(result).contains("href=\"/current\"", ">Alias</a>")
            .doesNotContain("/old", "<script", "<obsidian-core-link");
    }

    @Test
    void renderingWaitsForWarmup() {
        var cache = mock(PostLinkIndexCache.class);
        var loaded = new AtomicBoolean();
        when(cache.warmup()).thenReturn(Mono.fromRunnable(() -> loaded.set(true)));
        when(cache.lookup("Target", false)).thenAnswer(call -> loaded.get()
            ? Optional.of(new PostLinkIndexCache.PostTarget("target", "Target", "/target"))
            : Optional.empty());
        var handler = new ObsidianPostContentHandler(cache, new ObsidianSettings());
        var result = handler.handle(PostContentContext.builder().content("<p>[[Target]]</p>").build()).block();
        assertThat(result.getContent()).contains("href=\"/target\"");
    }

    @Test
    void graphOnlyContentBindsCurrentArticleWithoutLoadingWikilinkCache() {
        var cache = mock(PostLinkIndexCache.class);
        var post = new Post();
        post.setMetadata(new Metadata());
        post.getMetadata().setName("current");
        var context = PostContentContext.builder().post(post)
            .content("<obsidian-graph mode='local'></obsidian-graph>").build();
        var result = new ObsidianPostContentHandler(cache, new ObsidianSettings()).handle(context).block();
        assertThat(result.getContent()).contains("data-current-post=\"current\"");
        verifyNoInteractions(cache);
    }
}
