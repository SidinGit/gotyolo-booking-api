import { ApiProperty } from '@nestjs/swagger';

export type BookingState =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED';

export class Booking {
  @ApiProperty({ description: 'Booking unique identifier', type: String })
  id: string;

  @ApiProperty({
    description: 'Associated trip ID',
    type: String,
    format: 'uuid',
  })
  trip_id: string;

  @ApiProperty({
    description: 'User who made the booking',
    type: String,
    format: 'uuid',
  })
  user_id: string;

  @ApiProperty({ description: 'Number of seats reserved' })
  num_seats: number;

  @ApiProperty({
    enum: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
  })
  state: BookingState;

  @ApiProperty({
    description: 'Price captured at the time of booking (string decimal)',
    type: String,
  })
  price_at_booking: string; // Postgres DECIMAL returns as string in Node to prevent precision loss

  @ApiProperty({
    description: 'Payment reference from gateway',
    type: String,
    nullable: true,
  })
  payment_reference: string | null;

  @ApiProperty({
    description: 'Idempotency key used for payment request',
    type: String,
    nullable: true,
  })
  idempotency_key: string | null;

  @ApiProperty({
    description: 'Expiration timestamp for pending bookings',
    type: String,
    format: 'date-time',
  })
  expires_at: Date;

  @ApiProperty({
    description: 'Timestamp when booking was cancelled',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  cancelled_at: Date | null;

  @ApiProperty({
    description: 'Amount refunded (string decimal)',
    type: String,
    nullable: true,
  })
  refund_amount: string | null;

  @ApiProperty({
    description: 'Record creation timestamp',
    type: String,
    format: 'date-time',
  })
  created_at: Date;
}
