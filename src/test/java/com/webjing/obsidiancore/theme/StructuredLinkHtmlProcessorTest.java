package com.webjing.obsidiancore.theme;

import static org.assertj.core.api.Assertions.assertThat;
import com.webjing.obsidiancore.index.PostLinkIndexCache.PostTarget;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class StructuredLinkHtmlProcessorTest {
    @Test
    void rendersIdentityBoundTagWithCurrentUrlAndEscapedAlias() {
        String html = "<p>See <obsidian-core-link post='p1' url='/stale' title='Title'>A &amp; B</obsidian-core-link>.</p>";
        String result = StructuredLinkHtmlProcessor.render(html,
            name -> Optional.of(new PostTarget(name, "Renamed", "/new?x=1&y=2")));
        assertThat(result).startsWith("<p>See ").endsWith(".</p>")
            .contains("href=\"/new?x=1&amp;y=2\"", "data-obsidian-post=\"p1\"", ">A &amp; B</a>", "rel=\"noopener noreferrer\"")
            .doesNotContain("<obsidian-core-link", "/stale");
    }

    @Test
    void urlOnlyTagsUseSafeUrlAndTitleFallbackWithoutLookingUpArticle() {
        String result = StructuredLinkHtmlProcessor.render(
            "<obsidian-core-link url=\"https://example.com/page\" title=\"Example\" target=\"_self\"></obsidian-core-link>",
            name -> { throw new AssertionError("No article identity to look up"); });
        assertThat(result).contains("href=\"https://example.com/page\"", "target=\"_self\"", ">Example</a>")
            .doesNotContain("data-obsidian-post");
    }

    @Test
    void unresolvedArticleDoesNotFollowStaleCopiedUrl() {
        String result = StructuredLinkHtmlProcessor.render(
            "<obsidian-core-link post='deleted' url='/old' title='Deleted'>Alias</obsidian-core-link>",
            name -> Optional.empty());
        assertThat(result).contains("aria-disabled=\"true\"", ">Alias</span>").doesNotContain("href=");
    }

    @Test
    void stripsUntrustedAttributesAndBlocksUnsafeSchemes() {
        for (String url : new String[] {"javascript:alert(1)", "data:text/html,payload", "//evil.test", "/\\evil.test", "java&#10;script:alert(1)"}) {
            String result = StructuredLinkHtmlProcessor.render(
                "<obsidian-core-link url='" + url + "' onclick='alert(1)' style='position:fixed' title='Title'>Text</obsidian-core-link>",
                name -> Optional.empty());
            assertThat(result).doesNotContain("href=", "onclick", "position:fixed").contains("Text");
        }
    }

    @Test
    void preservesExamplesAndAttributesWithoutConvertingTheirTags() {
        String tag = "<obsidian-core-link post='p1' url='/a'>Text</obsidian-core-link>";
        String html = "<!-- " + tag + " --><pre><code>" + tag + "</code></pre>"
            + "<script>const text=\"" + tag + "\"</script>"
            + "<div title=\"" + tag + "\">untouched</div>";
        assertThat(StructuredLinkHtmlProcessor.render(html, name -> Optional.empty())).isEqualTo(html);
    }

    @Test
    void keepsOrdinaryAnchorsAndSupportsSelfClosingCustomTag() {
        String html = "<a href='/normal'>Normal</a><obsidian-core-link post='p1' title='Title'/>";
        assertThat(StructuredLinkHtmlProcessor.render(html,
            name -> Optional.of(new PostTarget(name, "Title", "/post"))))
            .startsWith("<a href='/normal'>Normal</a>").contains("href=\"/post\"", ">Title</a>");
    }
}
