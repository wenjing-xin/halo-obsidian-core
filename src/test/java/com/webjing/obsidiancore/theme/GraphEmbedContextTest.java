package com.webjing.obsidiancore.theme;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class GraphEmbedContextTest {
    @Test
    void bindsImplicitCurrentPostAndPreservesOtherModes() {
        assertThat(GraphEmbedContext.bindCurrentPost(
            "<p>intro</p><obsidian-graph mode=\"local\" post=\"\"></obsidian-graph>", "a"))
            .contains("data-current-post=\"a\"").startsWith("<p>intro</p>");
        String explicit = "<obsidian-graph mode='local' post='b'></obsidian-graph>";
        assertThat(GraphEmbedContext.bindCurrentPost(explicit, "a")).isEqualTo(explicit);
        String full = "<obsidian-graph mode=\"full\"></obsidian-graph>";
        assertThat(GraphEmbedContext.bindCurrentPost(full, "a")).isEqualTo(full);
    }

    @Test
    void supportsLegacyAttributesButSkipsExamplesAndComments() {
        assertThat(GraphEmbedContext.bindCurrentPost(
            "<obsidian-graph data-mode='local'></obsidian-graph>", "a"))
            .contains("data-current-post=\"a\"");
        String sample = "<code><obsidian-graph mode='local'></obsidian-graph></code>"
            + "<!-- <obsidian-graph mode='local'></obsidian-graph> -->";
        assertThat(GraphEmbedContext.bindCurrentPost(sample, "a")).isEqualTo(sample);
    }
}
