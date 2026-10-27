package com.webjing.obsidiancore.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ObsidianSettingsTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void readsJacksonThreeSettingsAndExclusions() {
        var settings = new ObsidianSettings();
        settings.update(mapper.readTree("""
            {
              "renderWikilinks": false,
              "caseSensitive": true,
              "renderBrokenLinks": true,
              "allowAnonymousGraph": true,
              "anonymousGraphDefaultMode": "local",
              "graphDefaultShowTaxonomy": false,
              "graphDefaultCollapseCategories": true,
              "graphMaxNodes": 240,
              "excludeCategories": ["category-a", "", "category-a", "  "],
              "excludeTags": ["tag-a", "tag-b"]
            }
            """));

        assertThat(settings.isRenderWikilinks()).isFalse();
        assertThat(settings.isCaseSensitive()).isTrue();
        assertThat(settings.isRenderBrokenLinks()).isTrue();
        assertThat(settings.isAllowAnonymousGraph()).isTrue();
        assertThat(settings.getAnonymousGraphDefaultMode()).isEqualTo("local");
        assertThat(settings.isGraphDefaultShowTaxonomy()).isFalse();
        assertThat(settings.isGraphDefaultCollapseCategories()).isTrue();
        assertThat(settings.getGraphMaxNodes()).isEqualTo(240);
        assertThat(settings.getExcludeCategories()).containsExactly("category-a");
        assertThat(settings.getExcludeTags()).containsExactlyInAnyOrder("tag-a", "tag-b");
    }

    @Test
    void missingValuesRetainDocumentedDefaults() {
        var settings = new ObsidianSettings();
        settings.update(mapper.readTree("{}"));

        assertThat(settings.isAllowAnonymousGraph()).isFalse();
        assertThat(settings.isRenderWikilinks()).isTrue();
        assertThat(settings.getGraphMaxNodes()).isEqualTo(500);
        assertThat(settings.getAnonymousGraphDefaultMode()).isEqualTo("full");
        assertThat(settings.getExcludeCategories()).isEmpty();
        assertThat(settings.getExcludeTags()).isEmpty();
    }
}
