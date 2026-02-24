export interface ProcessedWebhook {
  idempotency_key: string;
  booking_id: string;
  status: string;
  processed_at: Date;
}