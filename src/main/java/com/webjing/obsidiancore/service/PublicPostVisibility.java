package com.webjing.obsidiancore.service;

import run.halo.app.core.extension.content.Post;

/** Shared eligibility policy for data exposed on anonymous theme pages. */
public final class PublicPostVisibility {
    private PublicPostVisibility() {
    }

    public static boolean isVisible(Post post) {
        if (post == null || post.getMetadata() == null || post.getSpec() == null
            || post.isDeleted()) {
            return false;
        }
        var spec = post.getSpec();
        return Post.isPublic(spec) && Boolean.TRUE.equals(spec.getPublish())
            && spec.getReleaseSnapshot() != null && !spec.getReleaseSnapshot().isBlank();
    }
}
