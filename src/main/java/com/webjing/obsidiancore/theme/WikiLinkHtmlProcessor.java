package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.index.PostLinkIndexCache;
import java.util.Optional;
import org.springframework.web.util.HtmlUtils;

/**
 * <p>Pure-function HTML processor that turns {@code [[...]]} occurrences in post content
 * into links. Text inside {@code <pre>/<code>/<a>/<script>/<style>}, HTML comments,
 * inline code spans and attribute values is never touched.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public final class WikiLinkHtmlProcessor {

    private WikiLinkHtmlProcessor() {
    }

    /**
     * Resolves a wikilink target title to a post.
     */
    public interface TitleResolver {

        Optional<PostLinkIndexCache.PostTarget> resolve(String title);
    }

    /**
     * Replace wikilinks in the HTML content.
     *
     * @param content      post content (HTML)
     * @param resolver     title resolver backed by the post link index cache
     * @param renderBroken whether unresolved links get a weak rendering
     * @return processed content
     */
    public static String replace(String content, TitleResolver resolver, boolean renderBroken) {
        if (content == null || content.isEmpty() || !content.contains("[[")) {
            return content;
        }
        StringBuilder sb = new StringBuilder(content.length() + 64);
        int i = 0;
        int len = content.length();
        while (i < len) {
            if (content.startsWith("<!--", i)) {
                int end = content.indexOf("-->", i + 4);
                int stop = end < 0 ? len : end + 3;
                sb.append(content, i, stop);
                i = stop;
                continue;
            }
            if (content.charAt(i) == '<') {
                int gt = content.indexOf('>', i);
                if (gt < 0) {
                    sb.append(content, i, len);
                    break;
                }
                String tagBody = content.substring(i + 1, gt);
                sb.append(content, i, gt + 1);
                i = gt + 1;
                String name = tagName(tagBody);
                if (!tagBody.startsWith("/") && !tagBody.endsWith("/")
                    && isNoTouchTag(name)) {
                    int close = indexOfCloseTag(content, i, name);
                    int stop = close < 0 ? len : close;
                    sb.append(content, i, stop);
                    i = stop;
                }
                continue;
            }
            int next = nextTagStart(content, i);
            int stop = next < 0 ? len : next;
            replaceInText(content, i, stop, resolver, renderBroken, sb);
            i = stop;
        }
        return sb.toString();
    }

    /**
     * Replace wikilinks inside one plain-text region, skipping inline code spans.
     */
    private static void replaceInText(String content, int start, int stop,
                                      TitleResolver resolver, boolean renderBroken,
                                      StringBuilder sb) {
        int i = start;
        while (i < stop) {
            char c = content.charAt(i);
            if (c == '`') {
                int run = 0;
                while (i + run < stop && content.charAt(i + run) == '`') {
                    run++;
                }
                String token = "`".repeat(run);
                int close = content.indexOf(token, i + run);
                if (close < 0 || close > stop) {
                    sb.append(content, i, stop);
                    return;
                }
                sb.append(content, i, close + run);
                i = close + run;
                continue;
            }
            if (c == '[' && i + 1 < stop && content.charAt(i + 1) == '[') {
                int close = content.indexOf("]]", i + 2);
                if (close >= 0 && close + 2 <= stop) {
                    String inner = content.substring(i + 2, close);
                    String replaced = renderLink(inner, content.substring(i, close + 2),
                        resolver, renderBroken);
                    sb.append(replaced);
                    i = close + 2;
                    continue;
                }
            }
            sb.append(c);
            i++;
        }
    }

    private static String renderLink(String inner, String raw, TitleResolver resolver,
                                     boolean renderBroken) {
        var occurrence = com.webjing.obsidiancore.index.WikiLinkParser
            .buildOccurrence(inner, 0, "");
        if (occurrence == null) {
            return raw;
        }
        var target = resolver.resolve(occurrence.target());
        if (target.isPresent() && target.get().permalink() != null
            && !target.get().permalink().isBlank()) {
            String text = occurrence.alias() != null ? occurrence.alias()
                : target.get().title();
            return "<a href=\"" + HtmlUtils.htmlEscape(target.get().permalink()) + "\""
                + " class=\"obsidian-wikilink\">"
                + HtmlUtils.htmlEscape(text) + "</a>";
        }
        if (renderBroken) {
            return "<span class=\"obsidian-wikilink--unresolved\">"
                + HtmlUtils.htmlEscape(raw) + "</span>";
        }
        return raw;
    }

    private static int nextTagStart(String content, int from) {
        int next = content.indexOf('<', from);
        while (next > 0 && content.startsWith("<!--", next)) {
            next = content.indexOf('<', next + 4);
        }
        return next;
    }

    private static int indexOfCloseTag(String content, int from, String name) {
        String lower = content.toLowerCase();
        String token = "</" + name;
        int idx = from;
        while (true) {
            int found = lower.indexOf(token, idx);
            if (found < 0) {
                return -1;
            }
            int after = found + token.length();
            if (after >= lower.length() || lower.charAt(after) == '>'
                || Character.isWhitespace(lower.charAt(after))) {
                return found;
            }
            idx = found + 1;
        }
    }

    private static String tagName(String tag) {
        String name = tag.startsWith("/") ? tag.substring(1) : tag;
        int end = 0;
        while (end < name.length() && !Character.isWhitespace(name.charAt(end))
            && name.charAt(end) != '>') {
            end++;
        }
        return name.substring(0, end).toLowerCase();
    }

    private static boolean isNoTouchTag(String name) {
        return switch (name) {
            case "pre", "code", "a", "script", "style" -> true;
            default -> false;
        };
    }
}
