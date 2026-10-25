package com.webjing.obsidiancore.service;

import reactor.core.publisher.Mono;

/**
 * <p>Full re-index service: rebuilds all WikiLink entries from scratch. Runs at plugin
 * startup as a safety net and can be triggered manually from Console.</p>
 *
 * @author webjing
 * @since 1.0.0
 */
public interface ReindexService {

    /**
     * Re-index progress snapshot for the Console UI.
     */
    record ReindexProgress(boolean running, int processed, int total) {
    }

    /**
     * Trigger a full re-index. No-op when one is already running.
     *
     * @return true when the re-index was started
     */
    Mono<Boolean> reindexAll();

    /**
     * Current re-index progress.
     */
    ReindexProgress progress();

    /**
     * Remove stale WikiLink entries whose source post no longer exists.
     */
    Mono<Void> removeStaleEntries();
}
