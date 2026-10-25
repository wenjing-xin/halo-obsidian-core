package com.webjing.obsidiancore;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import run.halo.app.plugin.PluginContext;

@ExtendWith(MockitoExtension.class)
class ObsidianCorePluginTest {

    @Mock
    PluginContext context;

    @InjectMocks
    ObsidianCorePlugin plugin;

    @Test
    void contextLoads() {
        plugin.start();
        plugin.stop();
    }
}
