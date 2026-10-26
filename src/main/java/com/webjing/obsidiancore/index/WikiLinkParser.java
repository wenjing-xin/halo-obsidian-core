package com.webjing.obsidiancore.index;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Locale;
import java.util.List;
import com.webjing.obsidiancore.link.StructuredLinkTag;

/**
 * <p>Pure-function parser for {@code [[...]]} wikilinks in raw content. Works for both
 * markdown and HTML raw: {@code [[...]]} appears as plain text in either format.</p>
 *
 * <p>Excluded regions: fenced code blocks (``` / ~~~), inline code spans (backticks),
 * HTML comments, and HTML regions that must not be touched ({@code <pre>}, {@code <code>},
 * {@code <a>}, {@code <script>}, {@code <style>}).</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public final class WikiLinkParser {

    private WikiLinkParser() {
    }

    /**
     * One wikilink occurrence found in the raw content. For structured article
     * links ({@code <obsidian-core-link post="...">}) the target post is pinned by
     * {@code postName} and resolved by name instead of by title.
     */
    public record Occurrence(String target, String alias, String heading, String snippet,
                             int start, int end, String postName) {
    }

    private static final char[] FENCE_CHARS = {'`', '~'};

    /**
     * Find all wikilink occurrences in the raw content, skipping excluded regions.
     *
     * @param raw raw content (markdown or HTML)
     * @return list of occurrences in document order
     */
    public static List<Occurrence> parse(String raw) {
        List<Occurrence> occurrences = new ArrayList<>();
        if (raw == null || raw.isEmpty()) {
            return occurrences;
        }
        String indexable = WikiLinkContentMask.mask(raw);
        parseAnchorLinks(indexable, occurrences);
        String text = stripHtmlNoTouchRegions(indexable);
        int lineStart = 0;
        boolean inFence = false;
        char fenceChar = 0;
        int fenceLength = 0;
        while (lineStart <= text.length()) {
            int lineEnd = text.indexOf('\n', lineStart);
            if (lineEnd < 0) {
                lineEnd = text.length();
            }
            String line = text.substring(lineStart, lineEnd);
            String trimmed = line.stripLeading();
            int fenceRun = leadingFenceRun(trimmed);
            if (!inFence) {
                if (fenceRun >= 3) {
                    inFence = true;
                    fenceChar = trimmed.charAt(0);
                    fenceLength = fenceRun;
                } else {
                    parseLine(line, lineStart, occurrences);
                }
            } else {
                int closeOffset = countLeadingWhitespace(line);
                if (fenceRun >= fenceLength && fenceRun == trimmed.length()
                    && trimmed.charAt(0) == fenceChar) {
                    inFence = false;
                    fenceChar = 0;
                    fenceLength = 0;
                }
            }
            if (lineEnd == text.length()) {
                break;
            }
            lineStart = lineEnd + 1;
        }
        occurrences.sort(Comparator.comparingInt(Occurrence::start));
        return occurrences;
    }

    /** Index only article-bound custom tags; URL-only tags remain ordinary hyperlinks. */
    private static void parseAnchorLinks(String raw, List<Occurrence> occurrences) {
        for (var link : StructuredLinkTag.find(raw)) {
            if (link.post().isBlank()) continue;
            String context = raw.substring(Math.max(0, link.start() - 60),
                Math.min(raw.length(), link.end() + 60));
            String snippet = StructuredLinkTag.plainText(context);
            if (snippet.length() > 140) snippet = snippet.substring(0, 140);
            occurrences.add(new Occurrence(link.title(), link.text(), null, snippet,
                link.start(), link.end(), link.post()));
        }
    }

    private static int countLeadingWhitespace(String line) {
        int i = 0;
        while (i < line.length() && Character.isWhitespace(line.charAt(i))) {
            i++;
        }
        return i;
    }

    private static int leadingFenceRun(String trimmed) {
        if (trimmed.isEmpty()) {
            return 0;
        }
        char c = trimmed.charAt(0);
        for (char fc : FENCE_CHARS) {
            if (c == fc) {
                int run = 0;
                while (run < trimmed.length() && trimmed.charAt(run) == fc) {
                    run++;
                }
                return run;
            }
        }
        return 0;
    }

    /**
     * Remove regions of HTML raw that must never contain wikilinks: comments,
     * script/style bodies, pre/code bodies and anchor text.
     */
    private static String stripHtmlNoTouchRegions(String raw) {
        if (!raw.contains("<")) {
            return raw;
        }
        StringBuilder sb = new StringBuilder(raw.length());
        int i = 0;
        int len = raw.length();
        while (i < len) {
            if (raw.startsWith("<!--", i)) {
                int end = raw.indexOf("-->", i + 4);
                i = end < 0 ? len : end + 3;
                sb.append(' ');
                continue;
            }
            if (raw.charAt(i) == '<') {
                int gt = raw.indexOf('>', i);
                if (gt < 0) {
                    break;
                }
                String tag = raw.substring(i + 1, gt);
                String name = tagName(tag);
                boolean closing = tag.startsWith("/");
                if (!closing && isNoTouchTag(name)) {
                    String closeTag = "</" + name;
                    int close = raw.toLowerCase(Locale.ROOT).indexOf(closeTag, gt);
                    i = close < 0 ? len : indexAfterClose(raw, close);
                    sb.append(' ');
                    continue;
                }
                i = gt + 1;
                sb.append(' ');
                continue;
            }
            int next = raw.indexOf('<', i);
            if (next < 0) {
                next = len;
            }
            sb.append(raw, i, next);
            i = next;
        }
        return sb.toString();
    }

    private static int indexAfterClose(String raw, int close) {
        int gt = raw.indexOf('>', close);
        return gt < 0 ? raw.length() : gt + 1;
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
            case "pre", "code", "a", "obsidian-core-link", "script", "style" -> true;
            default -> false;
        };
    }

    private static void parseLine(String line, int lineOffset, List<Occurrence> occurrences) {
        int i = 0;
        int len = line.length();
        while (i < len) {
            char c = line.charAt(i);
            if (c == '`') {
                int run = 0;
                while (i + run < len && line.charAt(i + run) == '`') {
                    run++;
                }
                int close = line.indexOf(String.valueOf("`").repeat(run), i + run);
                i = close < 0 ? i + run : close + run;
                continue;
            }
            if (c == '[' && i + 1 < len && line.charAt(i + 1) == '[') {
                int close = line.indexOf("]]", i + 2);
                if (close > i) {
                    String inner = line.substring(i + 2, close);
                    Occurrence occ = buildOccurrence(inner, lineOffset + i, snippetOf(line, i,
                        close + 2));
                    if (occ != null) {
                        occurrences.add(occ);
                    }
                    i = close + 2;
                    continue;
                }
            }
            i++;
        }
    }

    private static String snippetOf(String line, int start, int end) {
        int from = Math.max(0, start - 60);
        int to = Math.min(line.length(), end + 60);
        String snippet = (line.substring(from, start) + "[[...]]"
            + line.substring(end, to)).replaceAll("\\s+", " ").trim();
        return snippet.length() > 140 ? snippet.substring(0, 140) : snippet;
    }

    /**
     * Build an occurrence from the inner text of a wikilink. Returns null for empty or
     * self-heading-only links ({@code [[#heading]]}), which are anchors rather than
     * links between posts.
     *
     * <p>Supported syntax: {@code [[target]]}, {@code [[target|alias]]},
     * {@code [[target#heading]]}, {@code [[target#heading|alias]]}.</p>
     */
    public static Occurrence buildOccurrence(String inner, int start, String snippet) {
        String remaining = inner;
        String alias = null;
        int pipe = remaining.indexOf('|');
        if (pipe >= 0) {
            alias = remaining.substring(pipe + 1).trim();
            alias = alias.isEmpty() ? null : alias;
            remaining = remaining.substring(0, pipe);
        }
        String heading = null;
        int hash = remaining.indexOf('#');
        if (hash > 0) {
            heading = remaining.substring(hash + 1).trim();
            heading = heading.isEmpty() ? null : heading;
            remaining = remaining.substring(0, hash);
        }
        String target = remaining.trim();
        if (target.isEmpty() || target.startsWith("#")) {
            return null;
        }
        return new Occurrence(target, alias, heading, snippet, start, start + inner.length(),
            null);
    }
}
