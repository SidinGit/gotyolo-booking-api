import { DatabaseSchema } from '../../database/interfaces/schema.interface';

export const TRIPS_SCHEMA: DatabaseSchema = {
  name: 'trips',
  dependsOn: [],
  table: `
    CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        available_seats INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        refundable_until_days_before INTEGER NOT NULL,
        cancellation_fee_percent DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
};