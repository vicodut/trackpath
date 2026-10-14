import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { AdminGuard } from '../auth/admin.guard.js';
import { PollsService } from './polls.service.js';
import { CreatePollDto, VoteDto, SuggestPollDto } from './polls.dto.js';

function getIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return (req.socket?.remoteAddress ?? 'unknown');
}

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Get()
  getAll(@Req() req: IncomingMessage) {
    return this.pollsService.getAll(getIp(req));
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreatePollDto) {
    return this.pollsService.create(dto);
  }

  @Post(':id/vote')
  vote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoteDto,
    @Req() req: IncomingMessage,
  ) {
    return this.pollsService.vote(id, dto.optionId, getIp(req));
  }

  @Patch(':id/close')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  close(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.close(id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePoll(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.deletePoll(id);
  }

  // ── Suggestions ──────────────────────────────────────────────────────────────

  @Post('suggestions')
  @HttpCode(HttpStatus.NO_CONTENT)
  suggest(@Body() dto: SuggestPollDto, @Req() req: IncomingMessage) {
    return this.pollsService.suggest(dto, getIp(req));
  }

  @Get('suggestions')
  @UseGuards(AdminGuard)
  getSuggestions() {
    return this.pollsService.getSuggestions();
  }

  @Post('suggestions/:id/accept')
  @UseGuards(AdminGuard)
  acceptSuggestion(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.acceptSuggestion(id);
  }

  @Delete('suggestions/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectSuggestion(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.rejectSuggestion(id);
  }
}
