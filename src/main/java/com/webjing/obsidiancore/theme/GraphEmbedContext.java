package com.webjing.obsidiancore.theme;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.web.util.HtmlUtils;

/** Binds implicit local embeds without reserializing the article's HTML. */
final class GraphEmbedContext {
    private static final Pattern TAGS = Pattern.compile(
        "<!--.*?-->|<(pre|code|script|style)\\b[^>]*>.*?</\\1\\s*>"
            + "|<obsidian-graph\\b(?:[^>\"']|\"[^\"]*\"|'[^']*')*>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ATTRIBUTES = Pattern.compile(
        "([\\w:-]+)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))");

    private GraphEmbedContext() {
    }

    static String bindCurrentPost(String html, String postName) {
        if (html == null || postName == null || postName.isBlank()) {
            return html;
        }
        Matcher tags = TAGS.matcher(html);
        StringBuilder result = new StringBuilder();
        while (tags.find()) {
            String tag = tags.group();
            if (!tag.regionMatches(true, 0, "<obsidian-graph", 0, "<obsidian-graph".length())) {
                tags.appendReplacement(result, Matcher.quoteReplacement(tag));
                continue;
            }
            String mode = "";
            String post = "";
            Matcher attrs = ATTRIBUTES.matcher(tag);
            while (attrs.find()) {
                String name = attrs.group(1);
                String value = attrs.group(2) != null ? attrs.group(2)
                    : attrs.group(3) != null ? attrs.group(3) : attrs.group(4);
                if (name.equalsIgnoreCase("mode") || name.equalsIgnoreCase("data-mode")) {
                    mode = value;
                }
                if (name.equalsIgnoreCase("post") || name.equalsIgnoreCase("data-post")) {
                    post = value;
                }
            }
            if (mode.equals("local") && post.isBlank()) {
                tag = tag.replaceAll("(?i)\\s+data-current-post\\s*=\\s*"
                    + "(?:\"[^\"]*\"|'[^']*'|[^\\s>]+)", "");
                tag = tag.replaceFirst("/?>$", Matcher.quoteReplacement(
                    " data-current-post=\"" + HtmlUtils.htmlEscape(postName) + "\">"));
            }
            tags.appendReplacement(result, Matcher.quoteReplacement(tag));
        }
        tags.appendTail(result);
        return result.toString();
    }
}
