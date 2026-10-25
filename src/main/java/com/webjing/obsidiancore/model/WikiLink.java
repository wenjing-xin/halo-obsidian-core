package com.webjing.obsidiancore.model;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.index.IndexSpecs;

/**
 * <p>WikiLink is the write-time index of one source post: every {@code [[...]]} occurrence
 * found in the release content, resolved or not, is recorded here. It is 1:1 with
 * {@code Post.metadata.name}, so backlink queries can use the {@code spec.linkedTargets}
 * multi-value index.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@GVK(group = "obsidian-core.halo.run", version = "v1alpha1", kind = "WikiLink",
    plural = "wikilinks", singular = "wikilink")
@Data
@EqualsAndHashCode(callSuper = true)
public class WikiLink extends AbstractExtension {

    private WikiLinkSpec spec;

    /**
     * Single-value index on the source post name (unique, 1:1 with Post).
     */
    public static final String SOURCE_POST_NAME_INDEX = "spec.sourcePostName";

    /**
     * Multi-value index of resolved target post names for backlink queries.
     */
    public static final String LINKED_TARGETS_INDEX = "spec.linkedTargets";

    /**
     * Multi-value index of unresolved target titles for reverse re-indexing.
     */
    public static final String UNRESOLVED_TITLES_INDEX = "spec.unresolvedTitles";

    /**
     * Register index specs used by the plugin scheme.
     */
    public static void registerIndexSpecs(IndexSpecs<WikiLink> indexSpecs) {
        indexSpecs.add(IndexSpecs.<WikiLink, String>single(SOURCE_POST_NAME_INDEX, String.class)
            .indexFunc(link ->
                link.getSpec() == null ? null : link.getSpec().getSourcePostName())
            .unique(true)
            .build());
        indexSpecs.add(IndexSpecs.<WikiLink, String>multi(LINKED_TARGETS_INDEX, String.class)
            .indexFunc(link -> link.getSpec() == null ? Set.<String>of()
                : link.getSpec().getLinkedTargets())
            .build());
        indexSpecs.add(IndexSpecs.<WikiLink, String>multi(UNRESOLVED_TITLES_INDEX, String.class)
            .indexFunc(link -> link.getSpec() == null ? Set.<String>of()
                : link.getSpec().getUnresolvedTitles())
            .build());
    }

    @Data
    @EqualsAndHashCode
    public static class WikiLinkSpec {
        private String sourcePostName;
        private String sourceTitle;
        private Integer resolvedCount;
        private Integer unresolvedCount;
        private Set<String> linkedTargets = new LinkedHashSet<>();
        private Set<String> unresolvedTitles = new LinkedHashSet<>();
        private List<LinkEntry> outgoingLinks;
        private List<LinkEntry> unresolvedLinks;
        private Instant indexedAt;
    }
}
