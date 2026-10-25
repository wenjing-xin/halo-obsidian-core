/**
 * Graph payload types shared by the Console UI and the theme-side web component.
 */

export type NodeType = 'post' | 'category' | 'tag'

export type EdgeType = 'wikilink' | 'taxonomy'

export interface GraphNode {
  id: string
  type: NodeType
  title: string
  permalink?: string | null
  categories: string[]
  tags: string[]
  degree: number
  size: number
  color?: string | null
  broken?: boolean
}

export interface GraphEdge {
  id: string
  type: EdgeType
  source: string
  target: string
}

export interface GraphPayload {
  nodes: GraphNode[]
  edges: GraphEdge[]
  brokenNodes: GraphNode[]
  brokenEdges: GraphEdge[]
  categoryPalette: string[]
  totalPosts: number
  truncated: boolean
}

export interface BacklinkItem {
  sourcePostName: string
  sourceTitle: string
  sourcePermalink?: string | null
  snippet: string
}

export interface BacklinksResult {
  items: BacklinkItem[]
  total: number
}

export interface UnresolvedItem {
  sourcePostName: string
  sourceTitle: string
  targetTitle: string
  snippet: string
}

export interface GraphSummary {
  wikilinkCount: number
  resolvedCount: number
  unresolvedCount: number
  lastIndexedAt?: string | null
  reindexing: boolean
  reindexProcessed: number
  reindexTotal: number
}

export type GraphMode = 'full' | 'local' | 'nodes'

export interface GraphQueryParams {
  mode?: GraphMode
  post?: string
  nodes?: string[]
  depth?: number
  showBroken?: boolean
  showTaxonomy?: boolean
}
