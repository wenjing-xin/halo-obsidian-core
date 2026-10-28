package com.webjing.obsidiancore.endpoint;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

@SuppressWarnings("unchecked")
class RoleTemplateTest {
    @Test
    void readRoleCoversConsoleReadEndpointsWithoutWriteOrRawIndexAccess() {
        var roles = roles("/extensions/role-template-obsidian-core.yaml");
        var view = roles.get(0);
        var metadata = (Map<String, Object>) view.get("metadata");
        assertThat(metadata.get("name")).isEqualTo("obsidian-core-role-view");
        var annotations = (Map<String, String>) metadata.get("annotations");
        assertThat(annotations.get("rbac.authorization.halo.run/ui-permissions"))
            .contains("plugin:obsidian-core:view");
        for (var resource : List.of("graph", "backlinks", "outgoing", "unresolved", "summary")) {
            assertThat(allows(view, ObsidianConsoleEndpoint.GROUP, resource, "get")).isTrue();
            assertThat(allows(view, ObsidianConsoleEndpoint.GROUP, resource, "list")).isTrue();
        }
        assertThat(allows(view, ObsidianConsoleEndpoint.GROUP, "reindex", "create")).isFalse();
        for (var role : roles) {
            assertThat(allows(role, "obsidian-core.halo.run", "wikilinks", "update")).isFalse();
            assertThat(allows(role, "content.halo.run", "posts", "update")).isFalse();
        }
        var manage = roles.get(1);
        var manageAnnotations = (Map<String, String>) ((Map<String, Object>) manage.get("metadata")).get("annotations");
        assertThat(manageAnnotations.get("rbac.authorization.halo.run/dependencies"))
            .contains("obsidian-core-role-view");
        assertThat(allows(manage, ObsidianConsoleEndpoint.GROUP, "reindex", "create")).isTrue();
    }

    @Test
    void anonymousRoleHasOnlyPublicGraphReadAccess() {
        var role = roles("/extensions/role-anonymous-graph.yaml").get(0);
        var rules = (List<Map<String, Object>>) role.get("rules");
        assertThat(rules).hasSize(1);
        assertThat(rules.get(0).get("apiGroups")).isEqualTo(List.of(ObsidianPublicEndpoint.GROUP));
        assertThat(rules.get(0).get("resources")).isEqualTo(List.of("graph"));
        assertThat(rules.get(0).get("verbs")).isEqualTo(List.of("get", "list"));
    }

    private boolean allows(Map<String, Object> role, String group, String resource, String verb) {
        return ((List<Map<String, Object>>) role.get("rules")).stream().anyMatch(rule ->
            ((List<String>) rule.get("apiGroups")).contains(group)
                && ((List<String>) rule.get("resources")).contains(resource)
                && ((List<String>) rule.get("verbs")).contains(verb));
    }

    private List<Map<String, Object>> roles(String path) {
        var resource = getClass().getResourceAsStream(path);
        assertThat(resource).isNotNull();
        var result = new ArrayList<Map<String, Object>>();
        new Yaml().loadAll(resource).forEach(value -> result.add((Map<String, Object>) value));
        return result;
    }
}
