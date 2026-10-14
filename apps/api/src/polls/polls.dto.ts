import { IsString, MinLength, IsArray, ArrayMinSize, IsInt } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];
}

export class VoteDto {
  @IsInt()
  optionId!: number;
}

export class SuggestPollDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];
}
