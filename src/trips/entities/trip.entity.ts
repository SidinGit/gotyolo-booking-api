import { ApiProperty } from '@nestjs/swagger';

export class Trip {
  @ApiProperty({ description: 'Unique identifier for the trip', type: String })
  id: string;

  @ApiProperty({ description: 'Title of the trip' })
  title: string;

  @ApiProperty({ description: 'Destination city or location' })
  destination: string;

  @ApiProperty({
    description: 'Start date/time',
    type: String,
    format: 'date-time',
  })
  start_date: Date;

  @ApiProperty({
    description: 'End date/time',
    type: String,
    format: 'date-time',
  })
  end_date: Date;

  @ApiProperty({
    description: 'Price as returned from Postgres (string decimal)',
    type: String,
  })
  price: string; // Postgres DECIMAL returns as string in node-postgres

  @ApiProperty({ description: 'Maximum capacity for the trip' })
  max_capacity: number;

  @ApiProperty({ description: 'Currently available seats' })
  available_seats: number;

  @ApiProperty({
    enum: ['DRAFT', 'PUBLISHED'],
    description: 'Publication status',
  })
  status: 'DRAFT' | 'PUBLISHED';

  @ApiProperty({ description: 'Days before start that refunds are allowed' })
  refundable_until_days_before: number;

  @ApiProperty({
    description: 'Cancellation fee percent returned as string',
    type: String,
  })
  cancellation_fee_percent: string;

  @ApiProperty({
    description: 'Creation timestamp',
    type: String,
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    type: String,
    format: 'date-time',
  })
  updated_at: Date;
}
