package com.webjing.obsidiancore.link;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.web.util.HtmlUtils;

/** Shared grammar for persisted obsidian-core-link tags. */
public record StructuredLinkTag(int start, int end, String post, String url,
                                String title, String text, String target) {
    public static final String TAG_NAME = "obsidian-core-link";
    private static final Pattern TOKENS = Pattern.compile(
        "<!--.*?(?:-->|$)|<(/?)([a-z][a-z0-9:-]*)(?=[\\s/>])"
            + "((?:[^>\"']|\"[^\"]*\"|'[^']*')*)>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ATTRIBUTES = Pattern.compile(
        "([^\\s=<>/]+)(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+)))?");

    public static List<StructuredLinkTag> find(String html) {
        List<StructuredLinkTag> found = new ArrayList<>();
        if (html == null || html.isEmpty()) return found;
        var tokens = TOKENS.matcher(html);
        int cursor = 0;
        while (tokens.find(cursor)) {
            cursor = tokens.end();
            if (tokens.group(2) == null || "/".equals(tokens.group(1))) continue;
            String name = tokens.group(2).toLowerCase(Locale.ROOT);
            boolean noTouch = List.of("pre", "code", "script", "style", "textarea").contains(name);
            if (!noTouch && !name.equals("a") && !name.equals(TAG_NAME)) continue;
            var close = Pattern.compile("</" + Pattern.quote(name) + "\\s*>",
                Pattern.CASE_INSENSITIVE).matcher(html);
            boolean selfClosing = tokens.group(3).stripTrailing().endsWith("/");
            int end;
            String inner;
            if (selfClosing && name.equals(TAG_NAME)) {
                end = cursor;
                inner = "";
            } else if (close.find(cursor)) {
                inner = html.substring(cursor, close.start());
                end = close.end();
            } else {
                if (noTouch || name.equals("a")) cursor = html.length();
                continue;
            }
            int start = tokens.start();
            cursor = end;
            if (noTouch) continue;
            Map<String, String> attrs = attributes(tokens.group(3));
            if (!name.equals(TAG_NAME)) continue;
            String post = attrs.getOrDefault("post", "").strip();
            String url = attrs.getOrDefault("url", "").strip();
            String text = plainText(inner);
            String title = attrs.getOrDefault("title", "").strip();
            if (title.isEmpty()) title = text.isEmpty() ? post : text;
            if (text.isEmpty()) text = title.isEmpty() ? url : title;
            found.add(new StructuredLinkTag(start, end, post, url, title, text,
                "_self".equals(attrs.get("target")) ? "_self" : "_blank"));
        }
        return found;
    }

    private static Map<String, String> attributes(String source) {
        Map<String, String> result = new LinkedHashMap<>();
        var matcher = ATTRIBUTES.matcher(source);
        while (matcher.find()) {
            String value = matcher.group(2) != null ? matcher.group(2)
                : matcher.group(3) != null ? matcher.group(3)
                : matcher.group(4) != null ? matcher.group(4) : "";
            result.putIfAbsent(matcher.group(1).toLowerCase(Locale.ROOT), HtmlUtils.htmlUnescape(value));
        }
        return result;
    }

    public static String plainText(String html) {
        return HtmlUtils.htmlUnescape(html.replaceAll("(?s)<[^>]*>", ""))
            .replace('\u00a0', ' ').replaceAll("\\s+", " ").strip();
    }

    /** Only site-root-relative or absolute HTTP(S) URLs are navigable. */
    public static Optional<String> safeUrl(String value) {
        if (value == null) return Optional.empty();
        String url = value.strip();
        if (url.isEmpty() || url.indexOf('\\') >= 0
            || url.chars().anyMatch(c -> c < 32 || c == 127)) return Optional.empty();
        if (url.startsWith("/") && !url.startsWith("//")) return Optional.of(url);
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                && uri.getRawAuthority() != null && !uri.getRawAuthority().isBlank()) {
                return Optional.of(url);
            }
        } catch (IllegalArgumentException ignored) {
            // Invalid or unsafe destinations remain non-clickable text.
        }
        return Optional.empty();
    }
}
