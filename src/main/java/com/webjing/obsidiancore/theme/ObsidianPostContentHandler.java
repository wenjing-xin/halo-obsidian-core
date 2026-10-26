package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.index.PostLinkIndexCache;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.theme.ReactivePostContentHandler;

/**
 * <p>Theme-side post content handler: renders {@code [[...]]} wikilinks into
 * links using the post link index cache, and keeps the {@code href} of
 * structured links ({@code <obsidian-core-link post="...">}, inserted via
 * the editor "文章关联" action) fresh so permalink changes never break them.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
@RequiredArgsConstructor
public class ObsidianPostContentHandler implements ReactivePostContentHandler {

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
        boolean hasAnchors = content.toLowerCase(Locale.ROOT).contains("<obsidian-core-link");
        if (!hasWikilinks && !hasAnchors) {
            return Mono.just(context);
        }
        return linkCache.warmup().then(Mono.fromSupplier(() -> apply(context, hasWikilinks)));
    }

    private PostContentContext apply(PostContentContext context, boolean hasWikilinks) {
        String content = context.getContent();
        content = StructuredLinkHtmlProcessor.render(content, linkCache::lookupByName);
        if (hasWikilinks) {
            boolean caseSensitive = settings.isCaseSensitive();
            content = WikiLinkHtmlProcessor.replace(content,
                title -> linkCache.lookup(title, caseSensitive),
                settings.isRenderBrokenLinks());
        }
        context.setContent(content);
        return context;
    }

}
