package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.config.ObsidianSettings;
import java.util.Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.PropertyPlaceholderHelper;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.model.IModelFactory;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.PluginContext;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

/**
 * <p>Injects the {@code <obsidian-graph>} web component script into the theme head when
 * anonymous graph display is enabled in the plugin settings. The script is served from
 * the plugin static assets directory and is versioned with the plugin version to bypass
 * browser cache after upgrades.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
@RequiredArgsConstructor
public class ObsidianGraphScriptInjector implements TemplateHeadProcessor {

    static final PropertyPlaceholderHelper PROPERTY_PLACEHOLDER_HELPER =
        new PropertyPlaceholderHelper("${", "}");

    private final PluginContext pluginContext;

    private final ObsidianSettings settings;

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
                              IElementModelStructureHandler structureHandler) {
        if (!settings.isAllowAnonymousGraph()) {
            return Mono.empty();
        }
        final IModelFactory modelFactory = context.getModelFactory();
        model.add(modelFactory.createText(obsidianGraphScript()));
        return Mono.empty();
    }

    private String obsidianGraphScript() {
        final Properties properties = new Properties();
        properties.setProperty("version", pluginContext.getVersion());

        return PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders("""
            <!-- obsidian-core start -->
            <script type="module" src="/plugins/obsidian-core/assets/static/obsidian-graph/obsidian-graph.js?version=${version}"></script>
            <!-- obsidian-core end -->
            """, properties);
    }
}
