import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { CheersService } from './cheers.service.js';
import { CreateCheerDto } from './cheers.dto.js';

@Controller('cheers')
export class CheersController {
  constructor(private readonly cheersService: CheersService) {}

  @Get()
  getPublic() {
    return this.cheersService.getPublic();
  }

  @Get('all')
  @UseGuards(AdminGuard)
  getAll() {
    return this.cheersService.getAll();
  }

  @Post()
  create(@Body() dto: CreateCheerDto) {
    return this.cheersService.create(dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.cheersService.delete(id);
  }
}
