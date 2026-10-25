package com.webjing.obsidiancore.endpoint;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.service.GraphService;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

/**
 * <p>Public (anonymous) graph endpoint for theme-side embedded components. Read-only and
 * strictly gated by the {@code allowAnonymousGraph} setting.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
@Component
public class ObsidianPublicEndpoint implements CustomEndpoint {

    public static final String GROUP = "api.obsidian-core.halo.run";

    public static final String VERSION = "v1alpha1";

    private final GraphService graphService;

    private final ObsidianSettings settings;

    public ObsidianPublicEndpoint(GraphService graphService, ObsidianSettings settings) {
        this.graphService = graphService;
        this.settings = settings;
    }

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        return RouterFunctions.route()
            .GET("graph", this::graph)
            .build();
    }

    private Mono<ServerResponse> graph(ServerRequest request) {
        if (!settings.isAllowAnonymousGraph()) {
            return ServerResponse.status(HttpStatus.FORBIDDEN).build();
        }
        var query = new GraphService.PublicGraphQuery(
            request.queryParam("mode").orElse("full"),
            request.queryParam("post").orElse(null),
            csvSet(request, "nodes"),
            request.queryParam("depth").map(Integer::parseInt).orElse(1),
            request.queryParam("showBroken").map(Boolean::parseBoolean).orElse(false),
            request.queryParam("showTaxonomy").map(Boolean::parseBoolean).orElse(true));
        return ServerResponse.ok().body(graphService.buildPublicGraph(query), GraphPayload.class);
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
