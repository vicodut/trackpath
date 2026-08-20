import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ManualPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  altitude?: number | null;

  @IsOptional()
  @IsString()
  message?: string | null;

  @IsOptional()
  @IsString()
  tag?: string | null;
}

/** Optional date range for backfill syncs — YYYY-MM-DD or full ISO8601. */
export class SyncRangeDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
