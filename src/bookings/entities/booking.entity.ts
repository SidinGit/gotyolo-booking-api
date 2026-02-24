export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface Booking {
  id: string;
  trip_id: string;
  num_seats: number;
  total_price: number;
  status: BookingStatus;
  created_at: Date;
  updated_at: Date;
}