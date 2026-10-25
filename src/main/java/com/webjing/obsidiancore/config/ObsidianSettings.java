package com.webjing.obsidiancore.config;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.Data;
import org.springframework.stereotype.Component;

/**
 * <p>Settings POJO backed by {@code settings.yaml} group {@code obsidian}, cached with
 * volatile state and refreshed on {@code PluginConfigUpdatedEvent}.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
@Data
public class ObsidianSettings {

    /**
     * Group name of the plugin settings in settings.yaml.
     */
    public static final String SETTING_GROUP = "obsidian";

    private boolean renderWikilinks = true;
    private boolean caseSensitive = false;
    private boolean renderBrokenLinks = false;
    private boolean allowAnonymousGraph = false;
    private String anonymousGraphDefaultMode = "full";
    private boolean graphDefaultShowTaxonomy = true;
    private boolean graphDefaultCollapseCategories = false;
    private Integer graphMaxNodes = 500;
    private Set<String> excludeCategories = new HashSet<>();
    private Set<String> excludeTags = new HashSet<>();

    /**
     * Update the cached settings from a JSON node fetched from SettingFetcher.
     *
     * @param json the JSON node of the setting group, may be null
     */
    public void update(JsonNode json) {
        if (json == null) {
            return;
        }
        this.renderWikilinks = json.path("renderWikilinks").asBoolean(true);
        this.caseSensitive = json.path("caseSensitive").asBoolean(false);
        this.renderBrokenLinks = json.path("renderBrokenLinks").asBoolean(false);
        this.allowAnonymousGraph = json.path("allowAnonymousGraph").asBoolean(false);
        this.anonymousGraphDefaultMode = json.path("anonymousGraphDefaultMode").asText("full");
        this.graphDefaultShowTaxonomy = json.path("graphDefaultShowTaxonomy").asBoolean(true);
        this.graphDefaultCollapseCategories =
            json.path("graphDefaultCollapseCategories").asBoolean(false);
        this.graphMaxNodes = json.path("graphMaxNodes").asInt(500);
        this.excludeCategories = toStringSet(json.path("excludeCategories"));
        this.excludeTags = toStringSet(json.path("excludeTags"));
    }

    private Set<String> toStringSet(JsonNode node) {
        if (node == null || !node.isArray()) {
            return new HashSet<>();
        }
        return StreamSupport.stream(node.spliterator(), false)
            .map(JsonNode::asText)
            .filter(text -> text != null && !text.isBlank())
            .collect(Collectors.toCollection(HashSet::new));
    }
}
