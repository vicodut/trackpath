export interface GhostPost {
  id: string;
  title: string;
  slug: string;
  feature_image: string | null;
  excerpt: string | null;
  published_at: string;
  reading_time: number | null;
}

export interface GhostPostFull extends GhostPost {
  html: string | null;
}

export interface GhostListResponse {
  posts: GhostPost[];
}

export interface GhostSingleResponse {
  posts: GhostPostFull[];
}
