import { DatabaseSchema } from '../../database/interfaces/schema.interface';

export const WEBHOOKS_SCHEMA: DatabaseSchema = {
  name: 'processed_webhooks',
  dependsOn: [],
  table: `
    CREATE TABLE IF NOT EXISTS processed_webhooks (
        idempotency_key VARCHAR(255) PRIMARY KEY,
        booking_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
};