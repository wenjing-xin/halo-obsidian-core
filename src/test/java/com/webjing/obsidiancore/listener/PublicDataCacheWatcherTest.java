package com.webjing.obsidiancore.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.index.PostLinkIndexCache;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.impl.PublicGraphCache;
import org.junit.jupiter.api.Test;
import run.halo.app.core.extension.content.Category;
import run.halo.app.core.extension.content.Post;
import run.halo.app.core.extension.content.Tag;
import run.halo.app.extension.ReactiveExtensionClient;

class PublicDataCacheWatcherTest {
    @Test
    void persistedPostTaxonomyAndIndexChangesInvalidateCachesAndDisposeUnregistersWatcher() {
        var client = mock(ReactiveExtensionClient.class);
        var graphs = mock(PublicGraphCache.class);
        var links = mock(PostLinkIndexCache.class);
        var watcher = new PublicDataCacheWatcher(client, graphs, links);
        watcher.afterPropertiesSet();
        verify(client).watch(watcher);
        watcher.onAdd(new Post());
        watcher.onUpdate(new Post(), new Post());
        watcher.onDelete(new Post());
        watcher.onUpdate(new Category(), new Category());
        watcher.onDelete(new Tag());
        watcher.onAdd(new WikiLink());
        watcher.onSettingsChanged(null);
        verify(graphs, times(7)).invalidate();
        verify(links, times(3)).invalidate();
        var dispose = mock(Runnable.class);
        watcher.registerDisposeHook(dispose);
        watcher.destroy();
        watcher.destroy();
        verify(dispose).run();
        assertThat(watcher.isDisposed()).isTrue();
        clearInvocations(graphs, links);
        watcher.onAdd(new Post());
        verifyNoInteractions(graphs, links);
    }
}
