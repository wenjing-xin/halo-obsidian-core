package com.webjing.obsidiancore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.ReindexService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.SettingFetcher;
import tools.jackson.databind.json.JsonMapper;

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
        verify(schemeManager).register(eq(WikiLink.class), any());
        plugin.stop();
        verify(schemeManager).fetch(any());
    }

    @Test
    void configUpdatedShouldReloadSettings() {
        var settings = new ObsidianSettings();
        var reindexService = mock(ReindexService.class);
        var mapper = JsonMapper.builder().build();
        when(settingFetcher.getSettingValue(ObsidianSettings.SETTING_GROUP))
            .thenReturn(mapper.readTree("{\"allowAnonymousGraph\":true,\"graphMaxNodes\":200}"),
                mapper.readTree("{\"allowAnonymousGraph\":false,\"graphMaxNodes\":300}"));
        var plugin = new ObsidianCorePlugin(context, schemeManager, settingFetcher, settings,
            reindexService);

        plugin.afterPropertiesSet();
        assertThat(settings.isAllowAnonymousGraph()).isTrue();
        assertThat(settings.getGraphMaxNodes()).isEqualTo(200);
        plugin.onConfigUpdated(null);
        assertThat(settings.isAllowAnonymousGraph()).isFalse();
        assertThat(settings.getGraphMaxNodes()).isEqualTo(300);
        verify(settingFetcher, org.mockito.Mockito.times(2))
            .getSettingValue(ObsidianSettings.SETTING_GROUP);
    }
}
