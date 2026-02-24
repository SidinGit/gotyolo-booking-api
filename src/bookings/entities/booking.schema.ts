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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        num_seats INTEGER NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        status booking_status_enum DEFAULT 'PENDING_PAYMENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
};