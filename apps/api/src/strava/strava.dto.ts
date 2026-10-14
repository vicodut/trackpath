import { IsISO8601, IsOptional } from 'class-validator';

/** Optional date range for backfill syncs — YYYY-MM-DD or full ISO8601. */
export class SyncRangeDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
