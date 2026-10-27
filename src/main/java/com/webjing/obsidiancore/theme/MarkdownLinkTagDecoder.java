package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.link.StructuredLinkTag;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.web.util.HtmlUtils;

/** Restores escaped custom link tags without decoding surrounding article HTML. */
final class MarkdownLinkTagDecoder {
    private static final Pattern HTML_TAG_START = Pattern.compile(
        "<(/?)([a-z][a-z0-9:-]*)(?=[\\s/>])", Pattern.CASE_INSENSITIVE);
    private static final Pattern ESCAPED_LINK_START = Pattern.compile(
        "&lt;obsidian-core-link(?=[\\s/&])", Pattern.CASE_INSENSITIVE);
    private static final Pattern ESCAPED_LINK_CLOSE = Pattern.compile(
        "&lt;/obsidian-core-link\\s*&gt;", Pattern.CASE_INSENSITIVE);

    private MarkdownLinkTagDecoder() {
    }

    /**
     * Some Markdown pipelines escape unknown inline HTML before post-content handlers run.
     * Restore only complete custom elements in normal text, leaving code and comments alone.
     */
    static String decode(String html) {
        if (html == null || html.isEmpty() || !html.toLowerCase(Locale.ROOT)
            .contains("&lt;obsidian-core-link")) {
            return html;
        }
        StringBuilder normalized = new StringBuilder(html.length());
        int cursor = 0;
        while (cursor < html.length()) {
            if (html.startsWith("<!--", cursor)) {
                int end = html.indexOf("-->", cursor + 4);
                int after = end < 0 ? html.length() : end + 3;
                normalized.append(html, cursor, after);
                cursor = after;
                continue;
            }

            Matcher rawTag = HTML_TAG_START.matcher(html);
            rawTag.region(cursor, html.length());
            if (html.charAt(cursor) == '<' && rawTag.lookingAt()) {
                String name = rawTag.group(2).toLowerCase(Locale.ROOT);
                int afterTag = rawTagEnd(html, cursor);
                if (afterTag < 0) {
                    normalized.append(html.substring(cursor));
                    break;
                }
                boolean opening = rawTag.group(1).isEmpty();
                boolean selfClosing = html.substring(cursor, afterTag - 1).stripTrailing().endsWith("/");
                if (opening && !selfClosing && isNoTouchTag(name)) {
                    int closeStart = findClosingTag(html, afterTag, name);
                    if (closeStart < 0) {
                        normalized.append(html.substring(cursor));
                        break;
                    }
                    int closeEnd = rawTagEnd(html, closeStart);
                    int afterRegion = closeEnd < 0 ? html.length() : closeEnd;
                    normalized.append(html, cursor, afterRegion);
                    cursor = afterRegion;
                } else {
                    normalized.append(html, cursor, afterTag);
                    cursor = afterTag;
                }
                continue;
            }

            Matcher escapedStart = ESCAPED_LINK_START.matcher(html);
            escapedStart.region(cursor, html.length());
            if (escapedStart.lookingAt()) {
                int openingEnd = escapedTagEnd(html, cursor + escapedStart.group().length());
                if (openingEnd >= 0) {
                    String opening = html.substring(cursor, openingEnd);
                    if (opening.stripTrailing().matches("(?is).*?/&gt;")) {
                        appendDecodedTag(normalized, opening);
                        cursor = openingEnd;
                        continue;
                    }
                    Matcher escapedClose = ESCAPED_LINK_CLOSE.matcher(html);
                    escapedClose.region(openingEnd, html.length());
                    if (escapedClose.find()) {
                        int end = escapedClose.end();
                        appendDecodedTag(normalized, html.substring(cursor, end));
                        cursor = end;
                        continue;
                    }
                }
            }

            normalized.append(html.charAt(cursor));
            cursor++;
        }
        return normalized.toString();
    }

    private static int rawTagEnd(String html, int start) {
        char quote = 0;
        for (int i = start + 1; i < html.length(); i++) {
            char c = html.charAt(i);
            if (quote != 0) {
                if (c == quote) quote = 0;
            } else if (c == '\'' || c == '"') {
                quote = c;
            } else if (c == '>') {
                return i + 1;
            }
        }
        return -1;
    }

    private static int escapedTagEnd(String html, int start) {
        char quote = 0;
        for (int i = start; i < html.length(); i++) {
            char c = html.charAt(i);
            if (c == '\'' || c == '"') {
                quote = quote == c ? 0 : quote == 0 ? c : quote;
            } else if (html.regionMatches(true, i, "&quot;", 0, 6)
                || html.regionMatches(true, i, "&#34;", 0, 5)) {
                quote = quote == '"' ? 0 : quote == 0 ? '"' : quote;
                i += html.regionMatches(true, i, "&quot;", 0, 6) ? 5 : 4;
            } else if (html.regionMatches(true, i, "&apos;", 0, 6)
                || html.regionMatches(true, i, "&#39;", 0, 5)) {
                quote = quote == '\'' ? 0 : quote == 0 ? '\'' : quote;
                i += html.regionMatches(true, i, "&apos;", 0, 6) ? 5 : 4;
            } else if (quote == 0 && html.regionMatches(true, i, "&gt;", 0, 4)) {
                return i + 4;
            }
        }
        return -1;
    }

    private static int findClosingTag(String html, int from, String name) {
        String closing = "</" + name;
        String lower = html.toLowerCase(Locale.ROOT);
        int candidate = from;
        while ((candidate = lower.indexOf(closing, candidate)) >= 0) {
            int afterName = candidate + closing.length();
            if (afterName == html.length() || Character.isWhitespace(html.charAt(afterName))
                || html.charAt(afterName) == '>') {
                return candidate;
            }
            candidate = afterName;
        }
        return -1;
    }

    private static boolean isNoTouchTag(String name) {
        return switch (name) {
            case "a", "pre", "code", "script", "style", "textarea" -> true;
            default -> false;
        };
    }

    /** Never inject decoded HTML: only restore one complete, sanitized custom tag. */
    private static void appendDecodedTag(StringBuilder output, String escaped) {
        String decoded = HtmlUtils.htmlUnescape(escaped);
        var links = StructuredLinkTag.find(decoded);
        if (links.size() != 1 || links.getFirst().start() != 0
            || links.getFirst().end() != decoded.length()) {
            output.append(escaped);
            return;
        }
        var link = links.getFirst();
        output.append("<obsidian-core-link post=\"")
            .append(HtmlUtils.htmlEscape(link.post())).append("\" url=\"")
            .append(HtmlUtils.htmlEscape(link.url())).append("\" title=\"")
            .append(HtmlUtils.htmlEscape(link.title())).append("\" target=\"")
            .append(link.target()).append("\">")
            .append(HtmlUtils.htmlEscape(link.text())).append("</obsidian-core-link>");
    }
}
