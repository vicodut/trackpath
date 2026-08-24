import { IsString, MinLength, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class CreateCheerDto {
  @IsString() @MinLength(1) @MaxLength(50) name!: string;
  @IsString() @MinLength(1) @MaxLength(280) message!: string;
  @IsBoolean() @IsOptional() isPublic?: boolean;
}
