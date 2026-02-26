import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';

export enum TripStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTripDto {
  @ApiProperty({ description: 'Short title of the trip' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Destination city or location' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Start date of the trip',
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'End date of the trip',
  })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiProperty({ description: 'Price per person in USD (two decimal places)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Maximum number of seats available' })
  @IsInt()
  @Min(1)
  max_capacity: number;

  @ApiProperty({
    description: 'How many days before start bookings are refundable',
  })
  @IsInt()
  @Min(0)
  refundable_until_days_before: number;

  @ApiProperty({
    description: 'Percentage fee charged on cancellation (0-100)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cancellation_fee_percent: number;

  @ApiPropertyOptional({
    enum: TripStatus,
    description: 'Trip status, defaults to DRAFT',
  })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;
}
