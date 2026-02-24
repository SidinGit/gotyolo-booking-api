export interface Trip {
  id: string;
  title: string;
  available_seats: number;
  price: number; // Note: pg returns decimals as strings by default to prevent float precision loss, but we'll type it as number for our DTOs/logic.
  refundable_until_days_before: number;
  cancellation_fee_percent: number;
  created_at: Date;
  updated_at: Date;
}