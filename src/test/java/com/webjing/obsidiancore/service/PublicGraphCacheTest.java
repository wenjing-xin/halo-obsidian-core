package com.webjing.obsidiancore.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.webjing.obsidiancore.dto.GraphModels.GraphPayload;
import com.webjing.obsidiancore.service.impl.PublicGraphCache;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

class PublicGraphCacheTest {
    private final PublicGraphCache cache = new PublicGraphCache();
    private final GraphPayload payload = new GraphPayload(List.of(), List.of(), List.of(),
        List.of(), List.of(), 0, false);

    private PublicGraphCache.Key key(String post) {
        return new PublicGraphCache.Key(new GraphService.PublicGraphQuery("local", post,
            Set.of(), 1, false, false), 500, Set.of(), Set.of());
    }

    @Test
    void concurrentSubscribersShareOneLoadAndInvalidationDoesNotRestoreOldInFlightResults() {
        var calls = new AtomicInteger();
        Sinks.One<GraphPayload> pending = Sinks.one();
        var cached = cache.get(key("a"), () -> {
            calls.incrementAndGet();
            return pending.asMono();
        });
        var first = cached.toFuture();
        var second = cache.get(key("a"), () -> Mono.error(new AssertionError())).toFuture();
        assertThat(calls.get()).isEqualTo(1);
        cache.invalidate();
        pending.tryEmitValue(payload);
        assertThat(first.join()).isSameAs(second.join());
        cache.get(key("a"), () -> { calls.incrementAndGet(); return Mono.just(payload); }).block();
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void failuresAreRetriedRatherThanCached() {
        var calls = new AtomicInteger();
        var value = cache.get(key("a"), () -> {
            if (calls.incrementAndGet() == 1) return Mono.error(new IllegalStateException("offline"));
            return Mono.just(payload);
        });
        assertThatThrownBy(value::block).isInstanceOf(IllegalStateException.class);
        value.block();
        value.block();
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void arbitraryScopeQueriesCannotGrowTheCacheBeyondItsBound() {
        var calls = new AtomicInteger();
        cache.get(key("first"), () -> { calls.incrementAndGet(); return Mono.just(payload); }).block();
        for (int i = 0; i < 128; i++) cache.get(key("post-" + i), () -> Mono.just(payload)).block();
        cache.get(key("first"), () -> { calls.incrementAndGet(); return Mono.just(payload); }).block();
        assertThat(calls.get()).isEqualTo(2);
    }
}
