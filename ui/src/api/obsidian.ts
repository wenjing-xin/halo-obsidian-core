/**
 * Hand-written API client for the obsidian-core plugin endpoints plus the core
 * content lists used by the filter panels.
 */
import { axiosInstance, consoleApiClient } from '@halo-dev/api-client'
import type {
  BacklinksResult,
  GraphMode,
  GraphPayload,
  GraphSummary,
  UnresolvedItem,
} from '../shared/graph-renderer/types'

const CONSOLE_API = '/apis/console.api.obsidian-core.halo.run/v1alpha1'
const PUBLIC_API = '/apis/api.obsidian-core.halo.run/v1alpha1'

export interface WikiLinkEntry {
  targetPostName?: string
  targetTitle: string
  alias?: string
  heading?: string
  snippet?: string
}

export interface WikiLinkExtension {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    creationTimestamp?: string
    version?: number
  }
  spec: {
    sourcePostName: string
    sourceTitle: string
    resolvedCount?: number
    unresolvedCount?: number
    linkedTargets?: string[]
    unresolvedTitles?: string[]
    outgoingLinks?: WikiLinkEntry[]
    unresolvedLinks?: WikiLinkEntry[]
    indexedAt?: string
  }
}

export interface ConsoleGraphParams {
  keyword?: string
  category?: string[]
  tag?: string[]
  showBroken?: boolean
  showTaxonomy?: boolean
  expandParents?: boolean
}

export interface PublicGraphParams {
  mode?: GraphMode
  post?: string
  nodes?: string[]
  depth?: number
  showBroken?: boolean
  showTaxonomy?: boolean
}

function joinCsv(values?: string[]): string | undefined {
  return values && values.length ? values.join(',') : undefined
}

export function fetchConsoleGraph(params: ConsoleGraphParams) {
  return axiosInstance.get<GraphPayload>(`${CONSOLE_API}/graph`, {
    params: {
      keyword: params.keyword || undefined,
      category: joinCsv(params.category),
      tag: joinCsv(params.tag),
      showBroken: params.showBroken,
      showTaxonomy: params.showTaxonomy,
      expandParents: params.expandParents,
    },
  })
}

export function fetchPublicGraph(params: PublicGraphParams) {
  return axiosInstance.get<GraphPayload>(`${PUBLIC_API}/graph`, {
    params: {
      mode: params.mode,
      post: params.post,
      nodes: joinCsv(params.nodes),
      depth: params.depth,
      showBroken: params.showBroken,
      showTaxonomy: params.showTaxonomy,
    },
  })
}

/**
 * Authenticated scoped graph for the editor embed preview; mirrors the public
 * endpoint semantics but does not depend on the anonymous-access setting.
 */
export function fetchConsoleGraphPreview(params: PublicGraphParams) {
  return axiosInstance.get<GraphPayload>(`${CONSOLE_API}/graph/preview`, {
    params: {
      mode: params.mode,
      post: params.post || undefined,
      nodes: joinCsv(params.nodes),
      depth: params.depth,
      showBroken: params.showBroken,
      showTaxonomy: params.showTaxonomy,
    },
  })
}

export function fetchBacklinks(postName: string) {
  return axiosInstance.get<BacklinksResult>(`${CONSOLE_API}/backlinks/${postName}`)
}

export function fetchOutgoing(postName: string) {
  return axiosInstance.get<WikiLinkExtension>(`${CONSOLE_API}/outgoing/${postName}`)
}

export function fetchUnresolvedLinks() {
  return axiosInstance.get<UnresolvedItem[]>(`${CONSOLE_API}/unresolved`)
}

export function fetchSummary() {
  return axiosInstance.get<GraphSummary>(`${CONSOLE_API}/summary`)
}

export function reindexAll() {
  return axiosInstance.post<boolean>(`${CONSOLE_API}/reindex`)
}

export interface TaxonomyOption {
  name: string
  displayName: string
}

interface TaxonomyListResponse {
  items: {
    metadata: { name: string }
    spec: { displayName?: string }
  }[]
}

export async function fetchCategoryOptions(): Promise<TaxonomyOption[]> {
  const { data } = await axiosInstance.get<TaxonomyListResponse>(
    '/apis/content.halo.run/v1alpha1/categories',
    { params: { size: 0 } },
  )
  return (data.items ?? []).map((item) => ({
    name: item.metadata.name,
    displayName: item.spec.displayName || item.metadata.name,
  }))
}

export async function fetchTagOptions(): Promise<TaxonomyOption[]> {
  const { data } = await axiosInstance.get<TaxonomyListResponse>(
    '/apis/content.halo.run/v1alpha1/tags',
    { params: { size: 0 } },
  )
  return (data.items ?? []).map((item) => ({
    name: item.metadata.name,
    displayName: item.spec.displayName || item.metadata.name,
  }))
}

export interface PostBrief {
  name: string
  title: string
  permalink?: string
}

export async function searchPostBriefs(
  keyword: string,
  options: { excludePostName?: string; publishedOnly?: boolean } = {},
): Promise<PostBrief[]> {
  // The generic extension list ignores keyword; Console's list supports title search.
  const { data } = await consoleApiClient.content.post.listPosts({
    size: 20,
    keyword: keyword.trim() || undefined,
    fieldSelector: [
      'spec.deleted=false',
      ...(options.excludePostName ? [`metadata.name!=${options.excludePostName}`] : []),
      ...(options.publishedOnly ? ['spec.publish=true'] : []),
    ],
  })
  return (data.items ?? []).map(({ post }) => ({
    name: post.metadata.name,
    title: post.spec.title || post.metadata.name,
    permalink: post.status?.permalink,
  })).filter((post) => post.name !== options.excludePostName
    && (!options.publishedOnly || !!post.permalink))
}
