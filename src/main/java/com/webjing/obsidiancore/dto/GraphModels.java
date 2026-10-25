package com.webjing.obsidiancore.dto;

import java.util.List;

/**
 * <p>Graph DTOs shared by Console and public endpoints.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public final class GraphModels {

    private GraphModels() {
    }

    public enum NodeType {
        post, category, tag
    }

    public enum EdgeType {
        wikilink, taxonomy
    }

    /**
     * A graph node: post, category or tag.
     */
    public record GraphNode(String id, NodeType type, String title, String permalink,
                            List<String> categories, List<String> tags, int degree, int size,
                            String color, boolean broken) {
    }

    /**
     * A graph edge between two node ids.
     */
    public record GraphEdge(String id, EdgeType type, String source, String target) {
    }

    /**
     * Full graph payload: main nodes/edges plus broken-link pseudo nodes/edges.
     */
    public record GraphPayload(List<GraphNode> nodes, List<GraphEdge> edges,
                               List<GraphNode> brokenNodes, List<GraphEdge> brokenEdges,
                               List<String> categoryPalette,
                               int totalPosts, boolean truncated) {
    }

    /**
     * One backlink item: a source post linking to the queried post.
     */
    public record BacklinkItem(String sourcePostName, String sourceTitle, String sourcePermalink,
                               String snippet) {
    }

    public record BacklinksResult(List<BacklinkItem> items, int total) {
    }

    /**
     * One unresolved (broken) link row.
     */
    public record UnresolvedItem(String sourcePostName, String sourceTitle, String targetTitle,
                                 String snippet) {
    }

    /**
     * Index summary for the Console dashboard.
     */
    public record GraphSummary(int wikilinkCount, int resolvedCount, int unresolvedCount,
                               String lastIndexedAt, boolean reindexing, int reindexProcessed,
                               int reindexTotal) {
    }
}
