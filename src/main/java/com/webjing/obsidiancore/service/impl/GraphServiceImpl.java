package com.webjing.obsidiancore.service.impl;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.dto.GraphModels.EdgeType;
import com.webjing.obsidiancore.dto.GraphModels.GraphEdge;
import com.webjing.obsidiancore.dto.GraphModels.GraphNode;
import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.dto.GraphModels.NodeType;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.GraphService;
import com.webjing.obsidiancore.service.PublicPostVisibility;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.content.Category;
import run.halo.app.core.extension.content.Post;
import run.halo.app.core.extension.content.Tag;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;

/**
 * <p>Default implementation of {@link GraphService}: loads posts/categories/tags/wikilinks
 * and assembles the graph payload in memory.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GraphServiceImpl implements GraphService {

    private static final String[] PALETTE = {
        "#a882ff", "#7cb8ff", "#69d2a8", "#ffc46b", "#ff8f8f",
        "#6bd6e0", "#e0a3ff", "#b5d76b"
    };

    private static final String CATEGORY_PREFIX = "category:";

    private static final String TAG_PREFIX = "tag:";

    private static final String BROKEN_PREFIX = "broken:";

    private static final int MAX_DEPTH = 5;

    private final ReactiveExtensionClient client;

    private final ObsidianSettings settings;

    private final PublicGraphCache publicCache;

    @Override
    public Mono<GraphPayload> buildConsoleGraph(GraphQuery query) {
        return buildGraph(query, false, null, null, 0);
    }

    @Override
    public Mono<GraphPayload> buildPublicGraph(PublicGraphQuery query) {
        return Mono.defer(() -> {
            // Canonical, immutable keys avoid mutation and redundant entries for equivalent scopes.
            var normalized = new PublicGraphQuery(query.mode() == null ? "full" : query.mode(),
                query.post(), query.nodes() == null ? Set.of() : Set.copyOf(query.nodes()),
                Math.min(Math.max(query.depth(), 1), MAX_DEPTH),
                false, query.showTaxonomy());
            var key = new PublicGraphCache.Key(normalized, settings.getGraphMaxNodes(),
                Set.copyOf(settings.getExcludeCategories()), Set.copyOf(settings.getExcludeTags()));
            // Anonymous graphs never expose unresolved titles (which may name private articles).
            return publicCache.get(key, () -> buildScopedGraph(normalized, true));
        });
    }

    @Override
    public Mono<GraphPayload> buildConsoleGraphPreview(PublicGraphQuery query) {
        return buildScopedGraph(query, false);
    }

    private Mono<GraphPayload> buildScopedGraph(PublicGraphQuery query, boolean publicOnly) {
        String mode = query.mode() == null ? "full" : query.mode();
        int depth = Math.min(Math.max(query.depth() <= 0 ? 1 : query.depth(), 1), MAX_DEPTH);
        GraphQuery base = new GraphQuery(null, Set.of(), Set.of(), query.showBroken(), !publicOnly,
            query.showTaxonomy(), false);
        return switch (mode) {
            case "local" -> query.post() == null || query.post().isBlank()
                ? Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Local graph requires a center post"))
                : buildGraph(base, publicOnly, query.post(), null, depth);
            case "nodes" -> query.nodes() == null || query.nodes().isEmpty()
                ? Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selected graph requires at least one post"))
                : buildGraph(base, publicOnly, null, query.nodes(), 0);
            case "full" -> buildGraph(base, publicOnly, null, null, 0);
            default -> Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Unknown graph mode"));
        };
    }

    private record GraphInputs(List<Post> posts, List<Category> categories, List<Tag> tags,
                               List<WikiLink> wikiLinks) {
    }

    private <T extends AbstractExtension> Map<String, T> byId(List<T> extensions) {
        Map<String, T> map = new HashMap<>();
        for (T ext : extensions) {
            map.put(ext.getMetadata().getName(), ext);
        }
        return map;
    }

    private Mono<GraphInputs> loadInputs() {
        var postsMono = client.listAll(Post.class, options(), Sort.unsorted())
            .filter(post -> {
                var spec = post.getSpec();
                if (spec == null || post.isDeleted()) {
                    return false;
                }
                if (spec.getTitle() == null || spec.getTitle().isBlank()) {
                    return false;
                }
                return true;
            })
            .collectList();
        var categoriesMono = client.listAll(Category.class, options(), Sort.unsorted())
            .collectList();
        var tagsMono = client.listAll(Tag.class, options(), Sort.unsorted()).collectList();
        var wikiLinksMono = client.listAll(WikiLink.class, options(), Sort.unsorted())
            .collectList();
        return Mono.zip(postsMono, categoriesMono, tagsMono, wikiLinksMono)
            .map(tuple -> new GraphInputs(tuple.getT1(), tuple.getT2(), tuple.getT3(),
                tuple.getT4()));
    }

    private ListOptions options() {
        return ListOptions.builder().build();
    }

    private Mono<GraphPayload> buildGraph(GraphQuery query, boolean publicOnly, String localRoot,
                                          Set<String> focusNodes, int depth) {
        return loadInputs().map(inputs -> assemble(inputs, query, publicOnly, localRoot,
            focusNodes, depth));
    }

    private GraphPayload assemble(GraphInputs inputs, GraphQuery query, boolean publicOnly,
                                  String localRoot, Set<String> focusNodes, int depth) {
        List<Post> posts = inputs.posts();
        List<WikiLink> wikiLinks = inputs.wikiLinks();
        Map<String, Category> categoryById = byId(inputs.categories());
        Map<String, Tag> tagById = byId(inputs.tags());
        var excludeCategories = settings.getExcludeCategories();
        var excludeTags = settings.getExcludeTags();

        // 1. Candidate posts after visibility and filters.
        Map<String, Post> postById = new LinkedHashMap<>();
        for (Post post : posts) {
            var spec = post.getSpec();
            boolean released = spec.getReleaseSnapshot() != null
                && !spec.getReleaseSnapshot().isBlank();
            if (publicOnly && !PublicPostVisibility.isVisible(post)) {
                continue;
            }
            if (!publicOnly && !query.includeDraft() && !released) {
                continue;
            }
            if (query.keyword() != null && !query.keyword().isBlank()
                && !spec.getTitle().toLowerCase(Locale.ROOT)
                    .contains(query.keyword().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (!query.categories().isEmpty()
                && !containsAny(spec.getCategories(), query.categories())) {
                continue;
            }
            if (!query.tags().isEmpty() && !containsAny(spec.getTags(), query.tags())) {
                continue;
            }
            postById.put(post.getMetadata().getName(), post);
        }

        // 2. Adjacency over wiki edges for sub-graph modes.
        Map<String, List<String>> adjacency = new HashMap<>();
        for (WikiLink link : wikiLinks) {
            var spec = link.getSpec();
            if (spec == null || !postById.containsKey(spec.getSourcePostName())
                || spec.getLinkedTargets() == null) {
                continue;
            }
            for (String target : spec.getLinkedTargets()) {
                if (!postById.containsKey(target)) {
                    continue;
                }
                adjacency.computeIfAbsent(spec.getSourcePostName(), k -> new ArrayList<>())
                    .add(target);
                adjacency.computeIfAbsent(target, k -> new ArrayList<>())
                    .add(spec.getSourcePostName());
            }
        }
        if (localRoot != null) {
            Set<String> scope = bfsScope(adjacency, localRoot, depth);
            scope.add(localRoot);
            postById.keySet().retainAll(scope);
        }
        if (focusNodes != null && !focusNodes.isEmpty()) {
            postById.keySet().retainAll(focusNodes);
        }

        // 3. Wiki edges among visible posts.
        Set<String> visiblePostIds = postById.keySet();
        List<GraphEdge> edges = new ArrayList<>();
        for (WikiLink link : wikiLinks) {
            var spec = link.getSpec();
            if (spec == null || spec.getLinkedTargets() == null
                || !visiblePostIds.contains(spec.getSourcePostName())) {
                continue;
            }
            for (String target : spec.getLinkedTargets()) {
                if (visiblePostIds.contains(target)) {
                    edges.add(new GraphEdge("wiki:" + spec.getSourcePostName() + "->" + target,
                        EdgeType.wikilink, spec.getSourcePostName(), target));
                }
            }
        }

        // 4. Broken nodes/edges.
        List<GraphNode> brokenNodes = new ArrayList<>();
        List<GraphEdge> brokenEdges = new ArrayList<>();
        if (query.showBroken()) {
            Set<String> brokenAdded = new HashSet<>();
            for (WikiLink link : wikiLinks) {
                var spec = link.getSpec();
                if (spec == null || spec.getUnresolvedTitles() == null
                    || !visiblePostIds.contains(spec.getSourcePostName())) {
                    continue;
                }
                for (String title : spec.getUnresolvedTitles()) {
                    String id = BROKEN_PREFIX + title;
                    if (brokenAdded.add(id)) {
                        brokenNodes.add(new GraphNode(id, NodeType.post, title, null,
                            List.of(), List.of(), 0, 1, "#8a8a94", true));
                    }
                    brokenEdges.add(new GraphEdge(
                        "broken:" + spec.getSourcePostName() + "->" + title,
                        EdgeType.wikilink, spec.getSourcePostName(), id));
                }
            }
        }

        // 5. Post nodes.
        List<GraphNode> nodes = new ArrayList<>();
        for (Post post : postById.values()) {
            var spec = post.getSpec();
            String permalink = post.getStatus() == null ? null : post.getStatus().getPermalink();
            List<String> postCats = displayNameList(spec.getCategories(), categoryById,
                Category.class);
            List<String> postTags = displayNameList(spec.getTags(), tagById, Tag.class);
            nodes.add(new GraphNode(post.getMetadata().getName(), NodeType.post,
                spec.getTitle(), permalink, postCats, postTags, 0, 1, null, false));
        }

        // 6. Category color assignment by leaf category usage order.
        Map<String, String> categoryColor = new HashMap<>();
        int paletteIndex = 0;
        for (String catName : postById.values().stream()
            .map(post -> post.getSpec().getCategories())
            .filter(cats -> cats != null && !cats.isEmpty())
            .map(cats -> cats.get(cats.size() - 1))
            .distinct()
            .toList()) {
            categoryColor.put(catName, PALETTE[paletteIndex % PALETTE.length]);
            paletteIndex++;
        }

        // 7. Taxonomy hubs and edges.
        for (int i = 0; i < nodes.size(); i++) {
            var node = nodes.get(i);
            var cats = postById.get(node.id()).getSpec().getCategories();
            String color = cats == null || cats.isEmpty() ? null
                : categoryColor.get(cats.get(cats.size() - 1));
            nodes.set(i, new GraphNode(node.id(), node.type(), node.title(), node.permalink(),
                node.categories(), node.tags(), node.degree(), node.size(), color, node.broken()));
        }
        if (query.showTaxonomy()) {
            addTaxonomy(postById, categoryById, tagById, excludeCategories, excludeTags,
                query.expandParents(), categoryColor, edges, nodes);
        }

        // 8. Degrees, sizes and colors.
        decorate(nodes, edges, brokenEdges, categoryColor, tagById);

        boolean truncated = false;
        int maxNodes = Math.max(1, settings.getGraphMaxNodes() == null
            ? 500 : settings.getGraphMaxNodes());
        int totalPosts = (int) nodes.stream().filter(n -> n.type() == NodeType.post).count();
        if (nodes.size() > maxNodes) {
            if (localRoot != null) {
                nodes.sort(java.util.Comparator.comparing(node -> !node.id().equals(localRoot)));
            }
            nodes = new ArrayList<>(nodes.subList(0, maxNodes));
            truncated = true;
        }
        Set<String> retained = nodes.stream().map(GraphNode::id)
            .collect(java.util.stream.Collectors.toSet());
        edges.removeIf(edge -> !retained.contains(edge.source()) || !retained.contains(edge.target()));
        brokenEdges.removeIf(edge -> !retained.contains(edge.source()));
        Set<String> brokenTargets = brokenEdges.stream().map(GraphEdge::target)
            .collect(java.util.stream.Collectors.toSet());
        brokenNodes.removeIf(node -> !brokenTargets.contains(node.id()));
        int remaining = Math.max(0, maxNodes - nodes.size());
        if (brokenNodes.size() > remaining) {
            brokenNodes = new ArrayList<>(brokenNodes.subList(0, remaining));
            truncated = true;
        }
        Set<String> keptBroken = brokenNodes.stream().map(GraphNode::id)
            .collect(java.util.stream.Collectors.toSet());
        brokenEdges.removeIf(edge -> !keptBroken.contains(edge.target()));

        return new GraphPayload(nodes, edges, brokenNodes, brokenEdges, List.of(PALETTE),
            totalPosts, truncated);
    }

    private void addTaxonomy(Map<String, Post> postById, Map<String, Category> categoryById,
                             Map<String, Tag> tagById, Set<String> excludeCategories,
                             Set<String> excludeTags, boolean expandParents,
                             Map<String, String> categoryColor,
                             List<GraphEdge> edges, List<GraphNode> nodes) {
        Set<String> addedNodes = new HashSet<>();
        Set<String> addedEdges = new HashSet<>();
        for (Post post : postById.values()) {
            var spec = post.getSpec();
            List<String> cats = spec.getCategories() == null ? List.of() : spec.getCategories();
            List<String> categoryChain = new ArrayList<>(cats);
            categoryChain.removeIf(excludeCategories::contains);
            if (!categoryChain.isEmpty()) {
                List<String> connectCats = expandParents ? categoryChain
                    : List.of(categoryChain.get(categoryChain.size() - 1));
                for (String catName : connectCats) {
                    String nodeId = CATEGORY_PREFIX + catName;
                    if (addedNodes.add(nodeId) && categoryById.containsKey(catName)) {
                        var category = categoryById.get(catName);
                        nodes.add(new GraphNode(nodeId, NodeType.category,
                            category.getSpec().getDisplayName(),
                            category.getStatus() == null ? null
                                : category.getStatus().getPermalink(),
                            List.of(), List.of(), 0, 1,
                            categoryColor.get(catName), false));
                    }
                    if (addedEdges.add(post.getMetadata().getName() + "->" + nodeId)) {
                        edges.add(new GraphEdge(
                            "tax:" + post.getMetadata().getName() + "->" + nodeId,
                            EdgeType.taxonomy, post.getMetadata().getName(), nodeId));
                    }
                }
            }
            List<String> tagNames = spec.getTags() == null ? List.of() : spec.getTags();
            for (String tagName : tagNames) {
                if (excludeTags.contains(tagName) || !tagById.containsKey(tagName)) {
                    continue;
                }
                String nodeId = TAG_PREFIX + tagName;
                if (addedNodes.add(nodeId)) {
                    var tag = tagById.get(tagName);
                    nodes.add(new GraphNode(nodeId, NodeType.tag, tag.getSpec().getDisplayName(),
                        tag.getStatus() == null ? null : tag.getStatus().getPermalink(),
                        List.of(), List.of(), 0, 1,
                        tagColorFor(tagById, tagName), false));
                }
                if (addedEdges.add(post.getMetadata().getName() + "->" + nodeId)) {
                    edges.add(new GraphEdge(
                        "tax:" + post.getMetadata().getName() + "->" + nodeId,
                        EdgeType.taxonomy, post.getMetadata().getName(), nodeId));
                }
            }
        }
    }

    private String tagColorFor(Map<String, Tag> tagById, String tagName) {
        var tag = tagById.get(tagName);
        var color = tag == null ? null : tag.getSpec().getColor();
        return color == null || color.isBlank() ? null : color;
    }

    private void decorate(List<GraphNode> nodes, List<GraphEdge> edges,
                          List<GraphEdge> brokenEdges, Map<String, String> categoryColor,
                          Map<String, Tag> tagById) {
        Map<String, Integer> degree = new HashMap<>();
        for (GraphEdge edge : edges) {
            degree.merge(edge.source(), 1, Integer::sum);
            degree.merge(edge.target(), 1, Integer::sum);
        }
        for (GraphEdge edge : brokenEdges) {
            degree.merge(edge.source(), 1, Integer::sum);
        }

        List<GraphNode> decorated = new ArrayList<>(nodes.size());
        for (GraphNode node : nodes) {
            int deg = degree.getOrDefault(node.id(), 0);
            int size = switch (node.type()) {
                case post -> 1 + Math.min(deg, 6);
                case category -> 3 + Math.min(deg / 2, 6);
                case tag -> 2 + Math.min(deg / 2, 5);
            };
            String color = node.color();
            if (color == null || color.isBlank()) {
                color = switch (node.type()) {
                    case post -> postColor(node, categoryColor);
                    case category -> PALETTE[0];
                    case tag -> PALETTE[4];
                };
            }
            decorated.add(new GraphNode(node.id(), node.type(), node.title(), node.permalink(),
                node.categories(), node.tags(), deg, size, color, node.broken()));
        }
        nodes.clear();
        nodes.addAll(decorated);
    }

    private String postColor(GraphNode node, Map<String, String> categoryColor) {
        if (node.categories() == null || node.categories().isEmpty()) {
            return "#9aa0a6";
        }
        return categoryColor.getOrDefault(node.categories().get(node.categories().size() - 1),
            "#9aa0a6");
    }

    private Set<String> bfsScope(Map<String, List<String>> adjacency, String root, int depth) {
        Set<String> scope = new HashSet<>();
        Set<String> frontier = Set.of(root);
        for (int i = 0; i < depth && !frontier.isEmpty(); i++) {
            Set<String> next = new HashSet<>();
            for (String node : frontier) {
                for (String neighbor : adjacency.getOrDefault(node, List.of())) {
                    if (scope.add(neighbor)) {
                        next.add(neighbor);
                    }
                }
            }
            frontier = next;
        }
        return scope;
    }

    private boolean containsAny(List<String> values, Set<String> selected) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        for (String value : values) {
            if (selected.contains(value)) {
                return true;
            }
        }
        return false;
    }

    private <T extends AbstractExtension> List<String> displayNameList(
        List<String> ids, Map<String, T> byId, Class<T> type) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<String> names = new ArrayList<>(ids.size());
        for (String id : ids) {
            var ext = byId.get(id);
            if (ext == null) {
                continue;
            }
            String displayName = null;
            if (type == Category.class && ext instanceof Category category) {
                displayName = category.getSpec().getDisplayName();
            } else if (type == Tag.class && ext instanceof Tag tag) {
                displayName = tag.getSpec().getDisplayName();
            }
            names.add(displayName == null ? id : displayName);
        }
        return names;
    }
}
