package com.webjing.obsidiancore;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.service.ReindexService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.SettingFetcher;

@ExtendWith(MockitoExtension.class)
class ObsidianCorePluginTest {

    @Mock
    PluginContext context;

    @Mock
    SchemeManager schemeManager;

    @Mock
    SettingFetcher settingFetcher;

    @Test
    void startAndStopShouldManageScheme() {
        var settings = new ObsidianSettings();
        var reindexService = mock(ReindexService.class);
        var plugin = new ObsidianCorePlugin(context, schemeManager, settingFetcher, settings,
            reindexService);

        plugin.afterPropertiesSet();
        plugin.start();
        verify(schemeManager).register(any(Class.class), any());
        plugin.stop();
        verify(schemeManager).fetch(any());
    }

    @Test
    void configUpdatedShouldReloadSettings() {
        var settings = new ObsidianSettings();
        var reindexService = mock(ReindexService.class);
        when(settingFetcher.get(ObsidianSettings.SETTING_GROUP)).thenReturn(null);
        var plugin = new ObsidianCorePlugin(context, schemeManager, settingFetcher, settings,
            reindexService);

        plugin.afterPropertiesSet();
        plugin.onConfigUpdated(null);
        verify(settingFetcher, org.mockito.Mockito.times(2))
            .get(ObsidianSettings.SETTING_GROUP);
    }
}
