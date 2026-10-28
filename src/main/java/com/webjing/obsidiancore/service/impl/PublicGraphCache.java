package com.webjing.obsidiancore.service.impl;

import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.service.GraphService.PublicGraphQuery;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/** Bounded, coalescing server-side cache; failures are never cached. */
@Component
public class PublicGraphCache {
    private static final int MAX_ENTRIES = 128;
    private static final Duration TTL = Duration.ofSeconds(30);

    public record Key(PublicGraphQuery query, Integer maxNodes,
                      Set<String> excludedCategories, Set<String> excludedTags) {
    }

    private final Map<Key, Mono<GraphPayload>> entries = new LinkedHashMap<>(16, 0.75f, true);

    public synchronized Mono<GraphPayload> get(Key key, Supplier<Mono<GraphPayload>> loader) {
        var cached = entries.get(key);
        if (cached != null) {
            return cached;
        }
        var value = Mono.defer(loader).cache(ignored -> TTL, error -> Duration.ZERO,
            () -> Duration.ZERO);
        if (entries.size() >= MAX_ENTRIES) {
            entries.remove(entries.keySet().iterator().next());
        }
        entries.put(key, value);
        return value;
    }

    public synchronized void invalidate() {
        entries.clear();
    }
}
