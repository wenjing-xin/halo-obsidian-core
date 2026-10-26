package com.webjing.obsidiancore.index;

import java.util.regex.Pattern;
import com.webjing.obsidiancore.link.StructuredLinkTag;

/** Masks code/examples before either structured-anchor or legacy wikilink parsing. */
final class WikiLinkContentMask {
    private static final Pattern HTML_REGIONS = Pattern.compile(
        "<!--.*?(?:-->|$)|<(pre|code|script|style)\\b(?:[^>\"']|\"[^\"]*\"|'[^']*')*>"
            + ".*?(?:</\\1\\s*>|$)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern FENCE = Pattern.compile("^ {0,3}(`{3,}|~{3,})(.*)$");
    private static final Pattern HTML_TAG = Pattern.compile(
        "</?[a-z][a-z0-9:-]*(?=[\\s/>])(?:[^>\"']|\"[^\"]*\"|'[^']*')*>",
        Pattern.CASE_INSENSITIVE);

    private WikiLinkContentMask() {
    }

    static String mask(String raw) {
        char[] masked = raw.toCharArray();
        var html = HTML_REGIONS.matcher(raw);
        while (html.find()) {
            erase(masked, html.start(), html.end());
        }
        String text = new String(masked);
        var customTags = StructuredLinkTag.find(text);
        char fenceChar = 0;
        int fenceSize = 0;
        int start = 0;
        while (start < text.length()) {
            int end = text.indexOf('\n', start);
            if (end < 0) end = text.length();
            var fence = FENCE.matcher(text.substring(start, end));
            boolean marker = fence.matches();
            if (fenceSize > 0) {
                erase(masked, start, end);
                if (marker && fence.group(1).charAt(0) == fenceChar
                    && fence.group(1).length() >= fenceSize && fence.group(2).isBlank()) {
                    fenceSize = 0;
                }
            } else if (marker && (fence.group(1).charAt(0) != '`'
                || !fence.group(2).contains("`"))) {
                fenceChar = fence.group(1).charAt(0);
                fenceSize = fence.group(1).length();
                erase(masked, start, end);
            } else if (text.startsWith("    ", start) || text.charAt(start) == '\t') {
                // Markdown indented code cannot create relationships either.
                int lineStart = start;
                boolean insideTag = customTags.stream()
                    .anyMatch(tag -> tag.start() < lineStart && tag.end() > lineStart);
                if (!insideTag) erase(masked, start, end);
            }
            start = end + 1;
        }
        text = new String(masked);
        boolean[] inAttribute = new boolean[text.length()];
        var tagMatcher = HTML_TAG.matcher(text);
        while (tagMatcher.find()) {
            for (int j = tagMatcher.start(); j < tagMatcher.end(); j++) inAttribute[j] = true;
        }
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) != '`' || inAttribute[i]) continue;
            int size = 1;
            while (i + size < text.length() && text.charAt(i + size) == '`') size++;
            int close = text.indexOf("`".repeat(size), i + size);
            while (close >= 0 && ((close > 0 && text.charAt(close - 1) == '`')
                || (close + size < text.length() && text.charAt(close + size) == '`'))) {
                close = text.indexOf("`".repeat(size), close + size);
            }
            if (close >= 0) {
                erase(masked, i, close + size);
                i = close + size - 1;
            } else {
                i += size - 1;
            }
        }
        return new String(masked);
    }

    private static void erase(char[] chars, int from, int to) {
        for (int i = from; i < to; i++) {
            if (chars[i] != '\n' && chars[i] != '\r') chars[i] = ' ';
        }
    }
}
