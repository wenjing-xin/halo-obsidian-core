package com.webjing.obsidiancore.listener;

import com.webjing.obsidiancore.index.PostLinkIndexCache;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.impl.PublicGraphCache;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import run.halo.app.core.extension.content.Category;
import run.halo.app.core.extension.content.Post;
import run.halo.app.core.extension.content.Tag;
import run.halo.app.extension.Extension;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Watcher;
import run.halo.app.plugin.PluginConfigUpdatedEvent;

/** Invalidates immediately on persisted changes, including visibility and reindex writes. */
@Component
@RequiredArgsConstructor
public class PublicDataCacheWatcher implements Watcher, InitializingBean, DisposableBean {
    private final ReactiveExtensionClient client;
    private final PublicGraphCache graphs;
    private final PostLinkIndexCache links;
    private final AtomicBoolean disposed = new AtomicBoolean();
    private Runnable disposeHook = () -> {};

    @Override
    public void afterPropertiesSet() {
        client.watch(this);
    }

    @Override
    public void onAdd(Extension extension) {
        invalidate(extension);
    }

    @Override
    public void onUpdate(Extension oldExtension, Extension newExtension) {
        invalidate(newExtension);
    }

    @Override
    public void onDelete(Extension extension) {
        invalidate(extension);
    }

    private void invalidate(Extension extension) {
        if (isDisposed()) {
            return;
        }
        if (extension instanceof Post) {
            links.invalidate();
        }
        if (extension instanceof Post || extension instanceof Category
            || extension instanceof Tag || extension instanceof WikiLink) {
            graphs.invalidate();
        }
    }

    @EventListener
    public void onSettingsChanged(PluginConfigUpdatedEvent event) {
        if (!isDisposed()) {
            graphs.invalidate();
        }
    }

    @Override
    public void registerDisposeHook(Runnable hook) {
        this.disposeHook = hook;
    }

    @Override
    public boolean isDisposed() {
        return disposed.get();
    }

    @Override
    public void dispose() {
        if (disposed.compareAndSet(false, true)) {
            graphs.invalidate();
            links.invalidate();
            disposeHook.run();
        }
    }

    @Override
    public void destroy() {
        dispose();
    }
}
