package com.webjing.obsidiancore.theme;

import static org.assertj.core.api.Assertions.assertThat;

import com.webjing.obsidiancore.index.PostLinkIndexCache.PostTarget;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class WikiLinkHtmlProcessorTest {

    private final WikiLinkHtmlProcessor.TitleResolver resolver =
            title -> Optional.ofNullable(Map.of(
                "文 B", new PostTarget("post-b", "文 B", "/posts/b"),
                "文 C", new PostTarget("post-c", "文 C", "/posts/c")
            ).get(title));

    @Test
    void shouldRenderResolvedLink() {
        String result = WikiLinkHtmlProcessor.replace("<p>见 [[文 B]]</p>", resolver, false);
        assertThat(result).isEqualTo(
            "<p>见 <a href=\"/posts/b\" class=\"obsidian-wikilink\">文 B</a></p>");
    }

    @Test
    void shouldRenderAliasText() {
        String result = WikiLinkHtmlProcessor.replace("<p>见 [[文 B|别名]]</p>", resolver, false);
        assertThat(result).contains(">别名</a>");
    }

    @Test
    void shouldKeepUnresolvedAsRawTextByDefault() {
        String result = WikiLinkHtmlProcessor.replace("<p>见 [[文 D]]</p>", resolver, false);
        assertThat(result).isEqualTo("<p>见 [[文 D]]</p>");
    }

    @Test
    void shouldWeakRenderUnresolvedWhenEnabled() {
        String result = WikiLinkHtmlProcessor.replace("<p>见 [[文 D]]</p>", resolver, true);
        assertThat(result).isEqualTo(
            "<p>见 <span class=\"obsidian-wikilink--unresolved\">[[文 D]]</span></p>");
    }

    @Test
    void shouldSkipCodeAndPreAndAnchorAndComments() {
        String raw = "<pre>[[文 B]]</pre><code>[[文 B]]</code>"
            + "<a href=\"x\">[[文 B]]</a><!-- [[文 B]] --><script>[[文 B]]</script>"
            + "<p>[[文 B]]</p>";
        String result = WikiLinkHtmlProcessor.replace(raw, resolver, false);
        assertThat(count(result, "obsidian-wikilink")).isEqualTo(1);
    }

    @Test
    void shouldSkipInlineCodeSpans() {
        String result = WikiLinkHtmlProcessor.replace("<p>`[[文 B]]` 然后 [[文 C]]</p>",
            resolver, false);
        assertThat(result).contains("`[[文 B]]`");
        assertThat(result).contains("class=\"obsidian-wikilink\"");
    }

    @Test
    void shouldEscapeLinkText() {
        String result = WikiLinkHtmlProcessor.replace("<p>[[文 B|a&b]]</p>", resolver, false);
        assertThat(result).contains(">a&amp;b</a>");
    }

    @Test
    void shouldHandleNullAndEmptyAndNoLinks() {
        assertThat(WikiLinkHtmlProcessor.replace(null, resolver, false)).isNull();
        assertThat(WikiLinkHtmlProcessor.replace("", resolver, false)).isEmpty();
        assertThat(WikiLinkHtmlProcessor.replace("<p>无链接</p>", resolver, false))
            .isEqualTo("<p>无链接</p>");
    }

    @Test
    void shouldHandleMultilineContent() {
        String raw = "<p>第一段 [[文 B]]</p>\n<p>第二段 [[文 C]]</p>";
        String result = WikiLinkHtmlProcessor.replace(raw, resolver, false);
        assertThat(count(result, "obsidian-wikilink")).isEqualTo(2);
    }

    private static int count(String text, String token) {
        int count = 0;
        int idx = 0;
        while ((idx = text.indexOf(token, idx)) >= 0) {
            count++;
            idx += token.length();
        }
        return count;
    }
}
