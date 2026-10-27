package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.index.PostLinkIndexCache.PostTarget;
import com.webjing.obsidiancore.link.StructuredLinkTag;
import java.util.Optional;
import java.util.function.Function;
import org.springframework.web.util.HtmlUtils;

/** Renders persisted custom tags as accessible links without a browser runtime. */
final class StructuredLinkHtmlProcessor {
    private StructuredLinkHtmlProcessor() {
    }

    static boolean containsTag(String html) {
        return !StructuredLinkTag.find(MarkdownLinkTagDecoder.decode(html)).isEmpty();
    }

    static String render(String html, Function<String, Optional<PostTarget>> resolver) {
        String normalized = MarkdownLinkTagDecoder.decode(html);
        StringBuilder output = new StringBuilder(normalized.length());
        int cursor = 0;
        for (var link : StructuredLinkTag.find(normalized)) {
            output.append(normalized, cursor, link.start());
            // A known article identity wins over a stale copied URL; missing targets are not followed.
            Optional<String> url = link.post().isBlank() ? StructuredLinkTag.safeUrl(link.url())
                : resolver.apply(link.post()).flatMap(target -> StructuredLinkTag.safeUrl(target.permalink()));
            String label = HtmlUtils.htmlEscape(link.text());
            if (url.isPresent()) {
                output.append("<a class=\"obsidian-wikilink obsidian-post-link\"");
                if (!link.post().isBlank()) {
                    output.append(" data-obsidian-post=\"")
                        .append(HtmlUtils.htmlEscape(link.post())).append("\"");
                }
                output.append(" href=\"").append(HtmlUtils.htmlEscape(url.get()))
                    .append("\" target=\"").append(link.target())
                    .append("\" rel=\"noopener noreferrer\" title=\"")
                    .append(HtmlUtils.htmlEscape(link.title())).append("\">")
                    .append(label).append("</a>");
            } else {
                output.append("<span class=\"obsidian-wikilink--unresolved\" aria-disabled=\"true\">")
                    .append(label).append("</span>");
            }
            cursor = link.end();
        }
        return output.append(normalized, cursor, normalized.length()).toString();
    }

}
