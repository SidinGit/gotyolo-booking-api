import { DatabaseSchema } from '../../database/interfaces/schema.interface';

export const BOOKINGS_SCHEMA: DatabaseSchema = {
  name: 'bookings',
  dependsOn: ['trips'],
  setup: `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') THEN
        CREATE TYPE booking_status_enum AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
      END IF;
    END $$;
  `,
  table: `
    CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        trip_id UUID REFERENCES trips(id) ON DELETE RESTRICT,
        user_id UUID NOT NULL,
        num_seats INTEGER NOT NULL,
        state VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
        price_at_booking DECIMAL(10, 2) NOT NULL,
        payment_reference VARCHAR(255),
        idempotency_key VARCHAR(255) UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        refund_amount DECIMAL(10, 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `,
};
