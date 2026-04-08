import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogService } from './blog.service.js';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  getPosts(@Query('order') order?: string) {
    return this.blogService.getPosts(order === 'asc' ? 'asc' : 'desc');
  }

  @Get('posts/:slug')
  getPost(@Param('slug') slug: string) {
    return this.blogService.getPost(slug);
  }
}
