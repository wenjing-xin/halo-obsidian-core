package com.webjing.obsidiancore.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * <p>Link entry of a wikilink occurrence, both resolved and unresolved.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LinkEntry {

    /**
     * Target post metadata name when the link is resolved, otherwise absent.
     */
    private String targetPostName;

    /**
     * Raw target title written in the wikilink syntax.
     */
    private String targetTitle;

    /**
     * Alias to display instead of the target title.
     */
    private String alias;

    /**
     * Optional heading fragment after {@code #} in the wikilink.
     */
    private String heading;

    /**
     * Surrounding context snippet of the occurrence.
     */
    private String snippet;
}
