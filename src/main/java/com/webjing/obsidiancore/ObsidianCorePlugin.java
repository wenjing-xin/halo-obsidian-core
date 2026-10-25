package com.webjing.obsidiancore;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.ReindexService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import run.halo.app.extension.GroupVersionKind;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.PluginConfigUpdatedEvent;
import run.halo.app.plugin.SettingFetcher;
import run.halo.app.plugin.event.PluginStartedEvent;

/**
 * <p>Plugin main class to manage the lifecycle of the plugin.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
public class ObsidianCorePlugin extends BasePlugin implements InitializingBean, DisposableBean {

    private final SchemeManager schemeManager;

    private final SettingFetcher settingFetcher;

    private final ObsidianSettings obsidianSettings;

    private final ReindexService reindexService;

    public ObsidianCorePlugin(PluginContext pluginContext, SchemeManager schemeManager,
        SettingFetcher settingFetcher, ObsidianSettings obsidianSettings,
        ReindexService reindexService) {
        super(pluginContext);
        this.schemeManager = schemeManager;
        this.settingFetcher = settingFetcher;
        this.obsidianSettings = obsidianSettings;
        this.reindexService = reindexService;
    }

    @Override
    public void start() {
        schemeManager.register(WikiLink.class, WikiLink::registerIndexSpecs);
        log.info("obsidian-core plugin started");
    }

    @Override
    public void stop() {
        schemeManager.fetch(GroupVersionKind.fromExtension(WikiLink.class))
            .ifPresent(schemeManager::unregister);
        log.info("obsidian-core plugin stopped");
    }

    @Override
    public void afterPropertiesSet() {
        obsidianSettings.update(settingFetcher.get(ObsidianSettings.SETTING_GROUP));
    }

    @Override
    public void destroy() {
        // Nothing to release eagerly; scheme is unregistered in stop().
    }

    @EventListener
    public void onConfigUpdated(PluginConfigUpdatedEvent event) {
        obsidianSettings.update(settingFetcher.get(ObsidianSettings.SETTING_GROUP));
        log.info("obsidian-core settings reloaded");
    }

    @EventListener
    public void onPluginStarted(PluginStartedEvent event) {
        if (event.getSource() instanceof PluginContext context
            && getContext().getName().equals(context.getName())) {
            reindexService.reindexAll().subscribe();
        }
    }
}
