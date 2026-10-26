package com.webjing.obsidiancore.endpoint;

import com.webjing.obsidiancore.dto.GraphModels.BacklinksResult;
import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.dto.GraphModels.GraphSummary;
import com.webjing.obsidiancore.dto.GraphModels.UnresolvedItem;
import com.webjing.obsidiancore.model.WikiLink;
import com.webjing.obsidiancore.service.BacklinkService;
import com.webjing.obsidiancore.service.GraphService;
import com.webjing.obsidiancore.service.ReindexService;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RequestPredicates;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

/**
 * <p>Console API endpoints for the obsidian-core plugin.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
public class ObsidianConsoleEndpoint implements CustomEndpoint {

    public static final String GROUP = "console.api.obsidian-core.halo.run";

    public static final String VERSION = "v1alpha1";

    private final GraphService graphService;

    private final BacklinkService backlinkService;

    private final ReindexService reindexService;

    public ObsidianConsoleEndpoint(GraphService graphService, BacklinkService backlinkService,
                                   ReindexService reindexService) {
        this.graphService = graphService;
        this.backlinkService = backlinkService;
        this.reindexService = reindexService;
    }

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        return RouterFunctions.route()
            .GET("graph", this::graph)
            .GET("graph/preview", this::graphPreview)
            .GET("backlinks/{name}", this::backlinks)
            .GET("outgoing/{name}", this::outgoing)
            .GET("unresolved", request -> ServerResponse.ok()
                .body(backlinkService.unresolved(), (Class) List.class))
            .POST("reindex", request -> ServerResponse.ok()
                .body(reindexService.reindexAll(), Boolean.class))
            .GET("summary", request -> ServerResponse.ok()
                .body(backlinkService.summary(), GraphSummary.class))
            .build();
    }

    private Mono<ServerResponse> graph(ServerRequest request) {
        var query = new GraphService.GraphQuery(
            request.queryParam("keyword").orElse(null),
            csvSet(request, "category"),
            csvSet(request, "tag"),
            request.queryParam("showBroken").map(Boolean::parseBoolean).orElse(false),
            request.queryParam("includeDraft").map(Boolean::parseBoolean).orElse(false),
            request.queryParam("showTaxonomy").map(Boolean::parseBoolean).orElse(true),
            request.queryParam("expandParents").map(Boolean::parseBoolean).orElse(false));
        return ServerResponse.ok().body(graphService.buildConsoleGraph(query), GraphPayload.class);
    }

    /**
     * Scoped graph preview (full/local/nodes) for the editor embed. Same semantics as
     * the public endpoint but authenticated, so it does not require anonymous access.
     */
    private Mono<ServerResponse> graphPreview(ServerRequest request) {
        var query = new GraphService.PublicGraphQuery(
            request.queryParam("mode").orElse("full"),
            request.queryParam("post").orElse(null),
            csvSet(request, "nodes"),
            request.queryParam("depth").map(Integer::parseInt).orElse(1),
            request.queryParam("showBroken").map(Boolean::parseBoolean).orElse(false),
            request.queryParam("showTaxonomy").map(Boolean::parseBoolean).orElse(true));
        return ServerResponse.ok().body(graphService.buildPublicGraph(query), GraphPayload.class);
    }

    private Mono<ServerResponse> backlinks(ServerRequest request) {
        String name = request.pathVariable("name");
        return ServerResponse.ok().body(backlinkService.backlinks(name), BacklinksResult.class);
    }

    private Mono<ServerResponse> outgoing(ServerRequest request) {
        String name = request.pathVariable("name");
        return ServerResponse.ok().body(backlinkService.outgoing(name), WikiLink.class);
    }

    private Set<String> csvSet(ServerRequest request, String param) {
        return request.queryParam(param)
            .map(value -> Arrays.stream(value.split(","))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet()))
            .orElse(Set.of());
    }

    @Override
    public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion(GROUP + "/" + VERSION);
    }
}
