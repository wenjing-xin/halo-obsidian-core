package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.index.PostLinkIndexCache;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import reactor.core.publisher.Mono;
import run.halo.app.theme.ReactivePostContentHandler;

/**
 * <p>Theme-side post content handler: renders {@code [[...]]} wikilinks into
 * links using the post link index cache, and keeps the {@code href} of
 * structured anchor links ({@code <a data-obsidian-post="...">}, inserted via
 * the editor "文章关联" action) fresh so permalink changes never break them.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
@RequiredArgsConstructor
public class ObsidianPostContentHandler implements ReactivePostContentHandler {

    private static final Pattern ANCHOR_OPEN_TAG = Pattern.compile(
        "<a\\b[^>]*\\bdata-obsidian-post\\s*=\\s*\"([^\"]*)\"[^>]*>",
        Pattern.CASE_INSENSITIVE);

    private static final Pattern HREF_ATTR = Pattern.compile("\\bhref\\s*=\\s*\"[^\"]*\"");

    private final PostLinkIndexCache linkCache;

    private final ObsidianSettings settings;

    @Override
    public Mono<PostContentContext> handle(PostContentContext context) {
        String content = context.getContent();
        if (content == null) {
            return Mono.just(context);
        }
        if (context.getPost() != null && context.getPost().getMetadata() != null) {
            content = GraphEmbedContext.bindCurrentPost(content,
                context.getPost().getMetadata().getName());
            context.setContent(content);
        }
        boolean hasWikilinks = settings.isRenderWikilinks() && content.contains("[[");
        boolean hasAnchors = content.contains("data-obsidian-post");
        if (!hasWikilinks && !hasAnchors) {
            return Mono.just(context);
        }
        return linkCache.warmup().then(Mono.fromSupplier(() -> apply(context, hasWikilinks)));
    }

    private PostContentContext apply(PostContentContext context, boolean hasWikilinks) {
        String content = context.getContent();
        if (hasWikilinks) {
            boolean caseSensitive = settings.isCaseSensitive();
            content = WikiLinkHtmlProcessor.replace(content,
                title -> linkCache.lookup(title, caseSensitive),
                settings.isRenderBrokenLinks());
        }
        content = refreshAnchorPermalinks(content);
        context.setContent(content);
        return context;
    }

    /**
     * Rewrite the {@code href} of every structured anchor link to the target's
     * current permalink. Anchors whose target no longer resolves keep their
     * stored href.
     */
    private String refreshAnchorPermalinks(String content) {
        if (!content.contains("data-obsidian-post")) {
            return content;
        }
        Matcher matcher = ANCHOR_OPEN_TAG.matcher(content);
        StringBuilder sb = new StringBuilder(content.length() + 64);
        while (matcher.find()) {
            String openTag = matcher.group(0);
            String postName = matcher.group(1).strip();
            Optional<PostLinkIndexCache.PostTarget> target =
                postName.isEmpty() ? Optional.empty() : linkCache.lookupByName(postName);
            String replacement = target
                .map(t -> withRefreshedHref(openTag, t.permalink()))
                .orElse(openTag);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private String withRefreshedHref(String openTag, String permalink) {
        if (permalink == null || permalink.isBlank()) {
            return openTag;
        }
        String escaped = HtmlUtils.htmlEscape(permalink);
        Matcher href = HREF_ATTR.matcher(openTag);
        if (href.find()) {
            return href.replaceFirst(Matcher.quoteReplacement("href=\"" + escaped + "\""));
        }
        return openTag.substring(0, openTag.length() - 1)
            + " href=\"" + escaped + "\">";
    }
}
