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
    void rendersMarkdownEscapedCustomElement() {
        String markdownHtml = "<p>&lt;obsidian-core-link post=&quot;p1&quot; url=&quot;/old&quot;"
            + " title=&quot;Article&quot;&gt;A &amp; B&lt;/obsidian-core-link&gt;</p>";
        assertThat(StructuredLinkHtmlProcessor.containsTag(markdownHtml)).isTrue();

        String result = StructuredLinkHtmlProcessor.render(markdownHtml,
            name -> Optional.of(new PostTarget(name, "Article", "/current")));
        assertThat(result).contains("href=\"/current\"", ">A &amp; B</a>")
            .doesNotContain("&lt;obsidian-core-link", "/old");
    }

    @Test
    void leavesEscapedCustomElementExamplesInCodeAndCommentsUntouched() {
        String example = "&lt;obsidian-core-link post=&quot;p1&quot;&gt;Text"
            + "&lt;/obsidian-core-link&gt;";
        String html = "<pre><code>" + example + "</code></pre><!-- " + example + " -->";
        assertThat(StructuredLinkHtmlProcessor.containsTag(html)).isFalse();
        assertThat(StructuredLinkHtmlProcessor.render(html, name -> Optional.empty()))
            .isEqualTo(html);
    }

    @Test
    void doesNotInjectDecodedMarkupFromMalformedEscapedTag() {
        String html = "<p>&lt;obsidian-core-link url=&quot;/safe&quot; title=&quot;"
            + "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"
            + "&lt;/obsidian-core-link&gt;&lt;script&gt;alert(1)&lt;/script&gt;</p>";
        String result = StructuredLinkHtmlProcessor.render(html, name -> Optional.empty());
        assertThat(result).doesNotContain("<img", "<script", "onerror=")
            .contains("href=\"/safe\"", "&lt;script&gt;");

        String malformed = "&lt;obsidian-core-link url=&quot;/safe&quot; title=&quot;"
            + "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&lt;/obsidian-core-link&gt;"
            + "&lt;img src=x onerror=alert(2)&gt;&lt;/obsidian-core-link&gt;";
        assertThat(StructuredLinkHtmlProcessor.render(malformed, name -> Optional.empty()))
            .doesNotContain("<img", "<script");
    }

    @Test
    void handlesLiteralAttributeQuotesAndSelfClosingEscapedTags() {
        String html = "<p>&lt;obsidian-core-link url='/safe' title='A &gt; B' /&gt;</p>";
        assertThat(StructuredLinkHtmlProcessor.render(html, name -> Optional.empty()))
            .contains("href=\"/safe\"", "A &gt; B</a>");
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
