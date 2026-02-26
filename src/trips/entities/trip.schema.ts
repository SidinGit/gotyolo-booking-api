import { DatabaseSchema } from '../../database/interfaces/schema.interface';

export const TRIPS_SCHEMA: DatabaseSchema = {
  name: 'trips',
  dependsOn: [],
  table: `
    CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        title VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        max_capacity INTEGER NOT NULL,
        available_seats INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'DRAFT',
        refundable_until_days_before INTEGER NOT NULL,
        cancellation_fee_percent DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `,
};