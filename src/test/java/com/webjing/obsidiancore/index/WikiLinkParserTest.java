package com.webjing.obsidiancore.index;

import static org.assertj.core.api.Assertions.assertThat;

import com.webjing.obsidiancore.index.WikiLinkParser.Occurrence;
import java.util.List;
import org.junit.jupiter.api.Test;

class WikiLinkParserTest {
    @Test
    void formattedMultilineTagsKeepIndentedAttributesAndLiteralBackticks() {
        String html = "<obsidian-core-link\n    post=\"p1\"\n    url=\"/a\"\n"
            + "    title=\"The `code` guide\"\n>Alias</obsidian-core-link>";
        var result = WikiLinkParser.parse(html);
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().postName()).isEqualTo("p1");
        assertThat(result.getFirst().target()).isEqualTo("The `code` guide");
    }

    @Test
    void shouldIndexCopiedHtmlTagByStablePostNameInMarkdown() {
        String raw = "参考 <obsidian-core-link post=\"target-post\" url=\"/target\">"
            + "A &amp; B &#91;Guide&#93;</obsidian-core-link>。";
        var result = WikiLinkParser.parse(raw);
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().postName()).isEqualTo("target-post");
        assertThat(result.getFirst().target()).isEqualTo("A & B [Guide]");
    }

    @Test
    void shouldNotIndexCopiedTagExamplesInsideCodeOrComments() {
        String anchor = "<obsidian-core-link post=\"target\">Target</obsidian-core-link>";
        String raw = "```html\n" + anchor + "\n```\n"
            + "   ~~~html\n" + anchor + "\n   ~~~\n"
            + "`" + anchor + "`\n    " + anchor + "\n"
            + "<pre><code>" + anchor + "</code></pre>"
            + "<!-- " + anchor + " --><script>" + anchor + "</script>";
        assertThat(WikiLinkParser.parse(raw)).isEmpty();
    }

    @Test
    void customTagUsesTitleForUnresolvedTargetAndTextAsAlias() {
        var result = WikiLinkParser.parse("<obsidian-core-link title='Target title' url='/old' post='p1'>Alias</obsidian-core-link>");
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().postName()).isEqualTo("p1");
        assertThat(result.getFirst().target()).isEqualTo("Target title");
        assertThat(result.getFirst().alias()).isEqualTo("Alias");
    }

    @Test
    void urlOnlyAndOldAnchorTagsDoNotCreateArticleRelationships() {
        assertThat(WikiLinkParser.parse("<obsidian-core-link url='/example' title='Example'></obsidian-core-link>"
            + "<a data-obsidian-post='old'>Old</a>")).isEmpty();
    }

    @Test
    void customTagInsideNormalAnchorDoesNotCreateNestedRelationships() {
        assertThat(WikiLinkParser.parse("<a href='/example'><obsidian-core-link post='p1'>Example</obsidian-core-link></a>")).isEmpty();
    }

    @Test
    void shouldParseBasicLinks() {
        List<Occurrence> result = WikiLinkParser.parse("见 [[文 B]] 与 [[Another]]");
        assertThat(result).hasSize(2);
        assertThat(result.get(0).target()).isEqualTo("文 B");
        assertThat(result.get(0).alias()).isNull();
        assertThat(result.get(0).heading()).isNull();
        assertThat(result.get(1).target()).isEqualTo("Another");
    }

    @Test
    void shouldParseAliasAndHeading() {
        List<Occurrence> result = WikiLinkParser.parse("[[文 B|别名]] 与 [[文 C#章节]] 与 [[文 D#章|别]]");
        assertThat(result).hasSize(3);
        assertThat(result.get(0).target()).isEqualTo("文 B");
        assertThat(result.get(0).alias()).isEqualTo("别名");
        assertThat(result.get(1).target()).isEqualTo("文 C");
        assertThat(result.get(1).heading()).isEqualTo("章节");
        assertThat(result.get(2).target()).isEqualTo("文 D");
        assertThat(result.get(2).heading()).isEqualTo("章");
        assertThat(result.get(2).alias()).isEqualTo("别");
    }

    @Test
    void shouldSkipSelfHeadingAndEmpty() {
        assertThat(WikiLinkParser.parse("[[#章节]]")).isEmpty();
        assertThat(WikiLinkParser.parse("[[]] 与 [[ ]]")).isEmpty();
    }

    @Test
    void shouldSkipFencedCodeBlocks() {
        String raw = """
            正文 [[文 B]]
            ```
            [[文 C]]
            ```
            ~~~
            [[文 D]]
            ~~~
            尾部 [[文 E]]
            """;
        List<Occurrence> result = WikiLinkParser.parse(raw);
        assertThat(result).extracting(Occurrence::target)
            .containsExactly("文 B", "文 E");
    }

    @Test
    void shouldSkipInlineCode() {
        List<Occurrence> result = WikiLinkParser.parse("正文 [[文 B]] 与 `code [[文 C]]` 尾部 [[文 D]]");
        assertThat(result).extracting(Occurrence::target)
            .containsExactly("文 B", "文 D");
    }

    @Test
    void shouldSkipHtmlNoTouchRegions() {
        String raw = "<p>正文 [[文 B]]</p><pre><code>[[文 C]]</code></pre>"
            + "<p><a href=\"x\">[[文 D]]</a> 和 [[文 E]]</p><!-- [[文 F]] -->"
            + "<script>var a = \"[[文 G]]\";</script>";
        List<Occurrence> result = WikiLinkParser.parse(raw);
        assertThat(result).extracting(Occurrence::target)
            .containsExactly("文 B", "文 E");
    }

    @Test
    void shouldHandleMultilineHtmlRaw() {
        String raw = "<p>第一段 [[文 B]]</p>\n<p>第二段 [[文 C]]</p>";
        List<Occurrence> result = WikiLinkParser.parse(raw);
        assertThat(result).extracting(Occurrence::target)
            .containsExactly("文 B", "文 C");
    }

    @Test
    void shouldHandleNullAndEmpty() {
        assertThat(WikiLinkParser.parse(null)).isEmpty();
        assertThat(WikiLinkParser.parse("")).isEmpty();
        assertThat(WikiLinkParser.parse("没有链接")).isEmpty();
    }

    @Test
    void shouldTrimWhitespaceAroundTarget() {
        List<Occurrence> result = WikiLinkParser.parse("[[ 文 B | 别名 ]]");
        assertThat(result).hasSize(1);
        assertThat(result.get(0).target()).isEqualTo("文 B");
        assertThat(result.get(0).alias()).isEqualTo("别名");
    }

    @Test
    void snippetShouldContainContext() {
        List<Occurrence> result = WikiLinkParser.parse("前文内容介绍 [[文 B]] 后文内容说明");
        assertThat(result.get(0).snippet()).contains("前文内容介绍");
        assertThat(result.get(0).snippet()).contains("后文内容说明");
    }
}
