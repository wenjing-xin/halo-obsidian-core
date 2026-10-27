package com.webjing.obsidiancore.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.dto.GraphModels.GraphNode;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.impl.GraphServiceImpl;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import run.halo.app.core.extension.content.Category;
import run.halo.app.core.extension.content.Post;
import run.halo.app.core.extension.content.Tag;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class GraphServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final ObsidianSettings settings = new ObsidianSettings();
    private final GraphService service = new GraphServiceImpl(client, settings);

    @BeforeEach
    void setup() {
        when(client.listAll(eq(Category.class), any(), any())).thenReturn(Flux.empty());
        when(client.listAll(eq(Tag.class), any(), any())).thenReturn(Flux.empty());
        when(client.listAll(eq(Post.class), any(), any())).thenReturn(
            Flux.just(post("a"), post("b"), post("c"), post("unrelated")));
        when(client.listAll(eq(WikiLink.class), any(), any())).thenReturn(
            Flux.just(link("a", "b"), link("b", "c")));
    }

    @Test
    void localDepthOnlyFollowsWikilinks() {
        assertThat(service.buildPublicGraph(query("local", "a", Set.of(), 1)).block().nodes())
            .extracting(GraphNode::id).containsExactlyInAnyOrder("a", "b");
        assertThat(service.buildPublicGraph(query("local", "a", Set.of(), 2)).block().nodes())
            .extracting(GraphNode::id).containsExactlyInAnyOrder("a", "b", "c");
    }

    @Test
    void selectedNodesDoNotIncludeUnselectedNeighbors() {
        var graph = service.buildPublicGraph(query("nodes", null, Set.of("a", "b"), 1)).block();
        assertThat(graph.nodes()).extracting(GraphNode::id).containsExactlyInAnyOrder("a", "b");
        assertThat(graph.edges()).hasSize(1);
    }

    @Test
    void missingScopeNeverFallsBackToFullGraph() {
        for (var query : List.of(query("local", null, Set.of(), 1),
            query("nodes", null, Set.of(), 1), query("invalid", null, Set.of(), 1))) {
            assertThatThrownBy(() -> service.buildPublicGraph(query).block())
                .isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test
    void privateAndUnpublishedPostsCannotBridgePublicLocalGraph() {
        var hidden = post("b");
        hidden.getSpec().setVisible(Post.VisibleEnum.PRIVATE);
        var unpublished = post("unpublished");
        unpublished.getSpec().setPublish(false);
        when(client.listAll(eq(Post.class), any(), any())).thenReturn(
            Flux.just(post("a"), hidden, post("c"), unpublished));
        assertThat(service.buildPublicGraph(query("local", "a", Set.of(), 3)).block().nodes())
            .extracting(GraphNode::id).containsExactly("a");
        assertThat(service.buildPublicGraph(query("full", null, Set.of(), 1)).block().nodes())
            .extracting(GraphNode::id).containsExactlyInAnyOrder("a", "c");
    }

    @Test
    void editorPreviewIncludesDraftCenterWithoutLeakingItToPublicGraph() {
        var draft = post("draft");
        draft.getSpec().setReleaseSnapshot(null);
        draft.getSpec().setPublish(false);
        var privatePost = post("private");
        privatePost.getSpec().setVisible(Post.VisibleEnum.PRIVATE);
        when(client.listAll(eq(Post.class), any(), any())).thenReturn(
            Flux.just(post("a"), draft, privatePost));

        assertThat(service.buildConsoleGraphPreview(query("local", "draft", Set.of(), 1))
            .block().nodes()).extracting(GraphNode::id).containsExactly("draft");
        assertThat(service.buildConsoleGraphPreview(query("nodes", null,
            Set.of("draft", "private"), 1)).block().nodes())
            .extracting(GraphNode::id).containsExactlyInAnyOrder("draft", "private");
        assertThat(service.buildPublicGraph(query("full", null, Set.of(), 1)).block().nodes())
            .extracting(GraphNode::id).containsExactly("a");
        assertThat(service.buildPublicGraph(query("local", "draft", Set.of(), 1)).block().nodes())
            .isEmpty();
    }

    @Test
    void previewScopeValidationNeverFallsBackToGlobal() {
        assertThatThrownBy(() -> service.buildConsoleGraphPreview(
            query("local", null, Set.of(), 1)).block())
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void truncatedGraphKeepsLocalCenterAndNoDanglingEdges() {
        settings.setGraphMaxNodes(1);
        var graph = service.buildPublicGraph(query("local", "c", Set.of(), 2)).block();
        assertThat(graph.nodes()).extracting(GraphNode::id).containsExactly("c");
        assertThat(graph.edges()).isEmpty();
        assertThat(graph.truncated()).isTrue();
    }

    private GraphService.PublicGraphQuery query(String mode, String post, Set<String> nodes, int depth) {
        return new GraphService.PublicGraphQuery(mode, post, nodes, depth, false, false);
    }

    private Post post(String name) {
        var post = new Post();
        post.setMetadata(new Metadata());
        post.getMetadata().setName(name);
        post.setSpec(new Post.PostSpec());
        post.getSpec().setTitle(name);
        post.getSpec().setPublish(true);
        post.getSpec().setVisible(Post.VisibleEnum.PUBLIC);
        post.getSpec().setReleaseSnapshot("release");
        return post;
    }

    private WikiLink link(String source, String target) {
        var link = new WikiLink();
        link.setSpec(new WikiLink.WikiLinkSpec());
        link.getSpec().setSourcePostName(source);
        link.getSpec().setLinkedTargets(Set.of(target));
        return link;
    }
}
