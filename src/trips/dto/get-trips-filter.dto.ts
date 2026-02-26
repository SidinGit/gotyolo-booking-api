import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetTripsFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by destination (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Filter trips starting on or after this date',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'Filter trips ending on or before this date',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Maximum price per seat' })
  @IsOptional()
  @Type(() => Number) // Converts the query string to a number
  @IsNumber()
  @Min(0)
  max_price?: number;
}
