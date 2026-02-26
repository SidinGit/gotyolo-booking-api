import { 
  Injectable, 
  Inject, 
  Logger, 
  NotFoundException, 
  BadRequestException 
} from '@nestjs/common';
import { Pool } from 'pg';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  // ==========================================
  // 1. CREATE BOOKING (Concurrent Safe)
  // ==========================================
  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    // We must check out a dedicated client from the pool to manage the transaction
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN'); // Start ACID Transaction

      // STEP 1: Lock the specific trip row. 
      // If 500 people hit this exactly at once, 499 of them will wait right here 
      // until the 1st person finishes their transaction.
      const tripResult = await client.query(
        'SELECT * FROM trips WHERE id = $1 FOR UPDATE',
        [createBookingDto.trip_id]
      );

      if (tripResult.rows.length === 0) {
        throw new NotFoundException('Trip not found');
      }

      const trip = tripResult.rows[0];

      // STEP 2: Business Logic Validation
      if (trip.status !== 'PUBLISHED') {
        throw new BadRequestException('Cannot book an unpublished trip');
      }

      if (trip.available_seats < createBookingDto.num_seats) {
        throw new BadRequestException(`Only ${trip.available_seats} seats remaining`);
      }

      // STEP 3: Calculate Finances & Expiry
      // price is stored as decimal, so we ensure it's treated as a float for math
      const priceAtBooking = parseFloat(trip.price) * createBookingDto.num_seats;

      // STEP 4: Deduct the seats from the Trip
      await client.query(
        'UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2',
        [createBookingDto.num_seats, trip.id]
      );

      // STEP 5: Create the Booking
      // Postgres natively handles adding 15 minutes to the current time for the expires_at field
      const insertQuery = `
        INSERT INTO bookings (trip_id, user_id, num_seats, state, price_at_booking, expires_at)
        VALUES ($1, $2, $3, 'PENDING_PAYMENT', $4, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
        RETURNING *;
      `;
      
      const bookingResult = await client.query(insertQuery, [
        trip.id,
        createBookingDto.user_id,
        createBookingDto.num_seats,
        priceAtBooking,
      ]);

      await client.query('COMMIT'); // Save everything
      this.logger.log(`Booking created successfully: ${bookingResult.rows[0].id}`);
      
      return bookingResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK'); // If ANYTHING fails, revert the seats and cancel the insert
      this.logger.error('Booking failed, transaction rolled back', error.stack);
      throw error;
    } finally {
      client.release(); // ALWAYS return the client back to the pool to prevent memory leaks!
    }
  }

  // ==========================================
  // 2. FETCH BOOKING
  // ==========================================
  async findOne(id: string): Promise<Booking> {
    const result = await this.pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }
    
    return result.rows[0];
  }

  // ==========================================
  // 3. PAYMENT WEBHOOK (Idempotent)
  // ==========================================
  async handlePaymentWebhook(payload: {
    event_id: string; // The idempotency key from Stripe/Razorpay
    booking_id: string;
    status: 'success' | 'failed';
    payment_reference?: string;
  }) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the booking row
      const bookingRes = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE', 
        [payload.booking_id]
      );

      if (bookingRes.rows.length === 0) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingRes.rows[0];

      // IDEMPOTENCY CHECK: 
      // If Stripe network glitches and sends the exact same success webhook twice,
      // we detect it here and safely ignore the second one without throwing an error.
      if (booking.idempotency_key === payload.event_id || booking.state !== 'PENDING_PAYMENT') {
        await client.query('ROLLBACK');
        this.logger.warn(`Webhook ignored: Booking ${booking.id} already processed or event duplicated.`);
        return { message: 'Webhook already processed successfully' }; 
      }

      if (payload.status === 'success') {
        // Payment Success -> Confirm Booking
        await client.query(
          `UPDATE bookings 
           SET state = 'CONFIRMED', payment_reference = $1, idempotency_key = $2 
           WHERE id = $3`,
          [payload.payment_reference, payload.event_id, payload.booking_id]
        );
      } else {
        // Payment Failed -> Cancel Booking and Return Seats
        await client.query(
          `UPDATE bookings 
           SET state = 'CANCELLED', idempotency_key = $1, cancelled_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [payload.event_id, payload.booking_id]
        );

        await client.query(
          'UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2',
          [booking.num_seats, booking.trip_id]
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Webhook processed. Booking ${booking.id} updated to ${payload.status === 'success' ? 'CONFIRMED' : 'CANCELLED'}`);
      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================
  // 4. CANCEL BOOKING
  // ==========================================

  async cancel(id: string): Promise<Booking> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock the booking and join with the trip to get refund policy
      const result = await client.query(`
        SELECT b.*, t.start_date, t.refundable_until_days_before, t.cancellation_fee_percent 
        FROM bookings b
        JOIN trips t ON b.trip_id = t.id
        WHERE b.id = $1 FOR UPDATE
      `, [id]);

      if (result.rows.length === 0) throw new NotFoundException('Booking not found');
      const booking = result.rows[0];

      if (booking.state === 'CANCELLED') throw new BadRequestException('Already cancelled');

      // 2. Calculate Refund Logic
      const startDate = new Date(booking.start_date);
      const now = new Date();
      const diffTime = startDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let refundAmount = 0;
      if (booking.state === 'CONFIRMED') {
        if (diffDays >= booking.refundable_until_days_before) {
          // Full refund minus fee percentage
          const fee = parseFloat(booking.price_at_booking) * (parseFloat(booking.cancellation_fee_percent) / 100);
          refundAmount = parseFloat(booking.price_at_booking) - fee;
        } else {
          // Too late for refund
          refundAmount = 0;
        }
      }

      // 3. Update Booking State
      const updatedBooking = await client.query(`
        UPDATE bookings 
        SET state = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, refund_amount = $1
        WHERE id = $2 RETURNING *
      `, [refundAmount, id]);

      // 4. Return the seats to the trip
      await client.query(
        'UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2',
        [booking.num_seats, booking.trip_id]
      );

      await client.query('COMMIT');
      return updatedBooking.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}