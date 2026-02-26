import { IsUUID, IsInt, Min, IsNotEmpty } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Identifier of the trip being booked',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  trip_id: string;

  // In a real app with auth, we'd get this from the JWT token.
  // Since auth is optional in this assessment, we'll accept it in the payload.
  @ApiProperty({
    description: 'Identifier of the user making the booking',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ description: 'Number of seats to reserve (minimum 1)' })
  @IsInt()
  @Min(1)
  num_seats: number;
}
