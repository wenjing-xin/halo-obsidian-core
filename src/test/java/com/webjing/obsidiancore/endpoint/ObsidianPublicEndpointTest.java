package com.webjing.obsidiancore.endpoint;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.webjing.obsidiancore.config.ObsidianSettings;
import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.service.GraphService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

class ObsidianPublicEndpointTest {
    @Test
    void disablingAnonymousAccessRejectsRequestsBeforeAnyCacheOrServiceLookup() {
        var graphs = mock(GraphService.class);
        var settings = new ObsidianSettings();
        var client = WebTestClient.bindToRouterFunction(new ObsidianPublicEndpoint(graphs, settings).endpoint()).build();
        client.get().uri("/graph").exchange().expectStatus().isForbidden();
        verifyNoInteractions(graphs);
        settings.setAllowAnonymousGraph(true);
        when(graphs.buildPublicGraph(any())).thenReturn(Mono.just(new GraphPayload(
            List.of(), List.of(), List.of(), List.of(), List.of(), 0, false)));
        client.get().uri("/graph").exchange().expectStatus().isOk()
            .expectHeader().valueEquals("Cache-Control", "no-store");
        settings.setAllowAnonymousGraph(false);
        client.get().uri("/graph").exchange().expectStatus().isForbidden();
        verify(graphs, times(1)).buildPublicGraph(any());
    }
}
