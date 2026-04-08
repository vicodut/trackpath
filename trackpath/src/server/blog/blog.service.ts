import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import type { GhostListResponse, GhostSingleResponse } from './blog.types.js';

const DEFAULT_GHOST_URL = 'https://ghost-production-1882.up.railway.app';
const DEFAULT_GHOST_KEY = '0d6476834a0eeaa76e910081c9';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);
  private readonly ghostUrl: string;
  private readonly ghostKey: string;

  constructor() {
    this.ghostUrl = process.env.GHOST_URL ?? DEFAULT_GHOST_URL;
    this.ghostKey = process.env.GHOST_CONTENT_API_KEY ?? DEFAULT_GHOST_KEY;
  }

  async getPosts(order: 'asc' | 'desc' = 'desc'): Promise<GhostListResponse> {
    const sortParam = order === 'asc' ? 'published_at%20asc' : 'published_at%20desc';
    const url =
      `${this.ghostUrl}/ghost/api/content/posts/` +
      `?key=${this.ghostKey}` +
      `&fields=id,title,slug,feature_image,excerpt,published_at,reading_time` +
      `&order=${sortParam}`;
    try {
      const res = await fetch(url);
      return (await res.json()) as GhostListResponse;
    } catch (err) {
      this.logger.error(`Ghost API error: ${(err as Error).message}`);
      throw new BadGatewayException('Failed to fetch blog posts');
    }
  }

  async getPost(slug: string): Promise<GhostSingleResponse> {
    const url =
      `${this.ghostUrl}/ghost/api/content/posts/slug/${slug}/` +
      `?key=${this.ghostKey}&formats=html`;
    try {
      const res = await fetch(url);
      return (await res.json()) as GhostSingleResponse;
    } catch (err) {
      this.logger.error(`Ghost API error: ${(err as Error).message}`);
      throw new BadGatewayException('Failed to fetch blog post');
    }
  }
}
