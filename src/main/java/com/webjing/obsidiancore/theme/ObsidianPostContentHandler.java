package com.webjing.obsidiancore.theme;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.index.PostLinkIndexCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.theme.ReactivePostContentHandler;

/**
 * <p>Theme-side post content handler that renders {@code [[...]]} wikilinks into links
 * using the post link index cache.</p>
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
        if (!settings.isRenderWikilinks() || context.getContent() == null
            || !context.getContent().contains("[[")) {
            return Mono.just(context);
        }
        return linkCache.warmup()
            .thenReturn(apply(context));
    }

    private PostContentContext apply(PostContentContext context) {
        boolean caseSensitive = settings.isCaseSensitive();
        String processed = WikiLinkHtmlProcessor.replace(context.getContent(),
            title -> linkCache.lookup(title, caseSensitive),
            settings.isRenderBrokenLinks());
        context.setContent(processed);
        return context;
    }
}
