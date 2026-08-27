import { IsISO8601 } from 'class-validator';

/** A date range (YYYY-MM-DD or full ISO8601) restricting synced data. */
export class CreateSyncPeriodDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;
}
