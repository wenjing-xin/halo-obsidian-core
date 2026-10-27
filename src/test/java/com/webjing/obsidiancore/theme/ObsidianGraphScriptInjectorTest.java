package com.webjing.obsidiancore.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.config.ObsidianSettings;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.model.IModelFactory;
import org.thymeleaf.model.IText;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import run.halo.app.plugin.PluginContext;

class ObsidianGraphScriptInjectorTest {
    @Test
    void linkRuntimeLoadsEvenWhenAnonymousGraphAccessIsDisabled() {
        assertThat(injectedMarkup(false)).contains("obsidian-links.css", "obsidian-link.js?version=test")
            .doesNotContain("obsidian-graph.js");
    }

    @Test
    void enabledGraphAccessAddsTheIndependentGraphRuntime() {
        assertThat(injectedMarkup(true)).contains("obsidian-link.js", "obsidian-graph.js?version=test");
    }

    private String injectedMarkup(boolean graphEnabled) {
        var plugin = mock(PluginContext.class);
        when(plugin.getVersion()).thenReturn("test");
        var settings = new ObsidianSettings();
        settings.setAllowAnonymousGraph(graphEnabled);
        var context = mock(ITemplateContext.class);
        var factory = mock(IModelFactory.class);
        when(context.getModelFactory()).thenReturn(factory);
        when(factory.createText(anyString())).thenReturn(mock(IText.class));
        new ObsidianGraphScriptInjector(plugin, settings).process(context, mock(IModel.class),
            mock(IElementModelStructureHandler.class)).block();
        var markup = ArgumentCaptor.forClass(String.class);
        verify(factory, atLeastOnce()).createText(markup.capture());
        return String.join("\n", markup.getAllValues());
    }
}
