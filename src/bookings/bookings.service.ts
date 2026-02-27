import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) { }

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
    booking_id: string;
    status: 'success' | 'failed';
    idempotency_key: string; // The idempotency key from Stripe/Razorpay
    payment_reference?: string;
  }) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Read: Fetch the trip_id without acquiring an exclusive lock
      const initialReadRes = await client.query(
        'SELECT trip_id FROM bookings WHERE id = $1',
        [payload.booking_id]
      );

      if (initialReadRes.rows.length === 0) {
        throw new NotFoundException('Booking not found');
      }

      const tripId = initialReadRes.rows[0].trip_id;

      // 2. Lock Parent: Lock the trip row
      await client.query(
        'SELECT id FROM trips WHERE id = $1 FOR UPDATE',
        [tripId]
      );

      // 3. Lock Child: Now safely lock the booking row
      const bookingRes = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [payload.booking_id]
      );

      const booking = bookingRes.rows[0];

      // IDEMPOTENCY CHECK: 
      // If Stripe network glitches and sends the exact same success webhook twice,
      // we detect it here and safely ignore the second one without throwing an error.
      if (booking.idempotency_key === payload.idempotency_key || booking.state !== 'PENDING_PAYMENT') {
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
          [payload.payment_reference, payload.idempotency_key, payload.booking_id]
        );
      } else {
        // Payment Failed -> Expire Booking and Return Seats
        await client.query(
          `UPDATE bookings 
           SET state = 'EXPIRED', idempotency_key = $1 
           WHERE id = $2`,
          [payload.idempotency_key, payload.booking_id]
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

      // 1. Read: get the trip_id first without locking
      const initialReadRes = await client.query(
        'SELECT trip_id FROM bookings WHERE id = $1',
        [id]
      );
      if (initialReadRes.rows.length === 0) throw new NotFoundException('Booking not found');
      const tripId = initialReadRes.rows[0].trip_id;

      // 2. Lock Parent: Lock the trip row and get refund policy data
      const tripRes = await client.query(
        'SELECT start_date, refundable_until_days_before, cancellation_fee_percent FROM trips WHERE id = $1 FOR UPDATE',
        [tripId]
      );
      const trip = tripRes.rows[0];

      // 3. Lock Child: Lock the booking row and get booking data
      const bookingRes = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [id]
      );
      const booking = bookingRes.rows[0];

      // 4. Checking against existing state
      if (booking.state === 'CANCELLED' || booking.state === 'EXPIRED') {
        throw new BadRequestException('Cannot cancel an already cancelled or expired booking');
      }

      // 5. Calculate Refund Logic
      const startDate = new Date(trip.start_date);
      const now = new Date();
      const diffTime = startDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let refundAmount = 0;
      let shouldReleaseSeats = false;

      if (diffDays >= trip.refundable_until_days_before) {
        // --- BEFORE CUTOFF ---
        // Both PENDING_PAYMENT and CONFIRMED are valid here.
        if (booking.state === 'CONFIRMED' || booking.state === 'PENDING_PAYMENT') {
          // Full price at booking minus the cancellation fee percentage
          const fee = parseFloat(booking.price_at_booking) * (parseFloat(trip.cancellation_fee_percent) / 100);
          refundAmount = parseFloat(booking.price_at_booking) - fee;

          shouldReleaseSeats = true;
        }
      }
      else {
        // --- AFTER CUTOFF ---

        // Invalid States: Cannot cancel PENDING_PAYMENT after cutoff.
        if (booking.state === 'PENDING_PAYMENT') {
          // We need a 409 Conflict! NestJS provides ConflictException.
          throw new ConflictException('Cannot cancel pending payment after cutoff');
        }

        // It's a CONFIRMED booking. Refund is $0 (default).
        shouldReleaseSeats = false; // Trip is imminent!

      }

      // 6. Update Booking State
      const updatedBooking = await client.query(`
        UPDATE bookings 
        SET state = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, refund_amount = $1
        WHERE id = $2 RETURNING *
      `, [refundAmount, id]);

      // 7. Conditionally Return the seats to the trip
      if (shouldReleaseSeats) {
        await client.query(
          'UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2',
          [booking.num_seats, booking.trip_id]
        );
      }

      await client.query('COMMIT');
      return updatedBooking.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ==========================================
  // 5. AUTO-EXPIRY (Cron Job)
  // ==========================================
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoExpiry() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Find all PENDING_PAYMENT bookings that have expired and transition them.
      const expireQuery = `
        UPDATE bookings 
        SET state = 'EXPIRED' 
        WHERE state = 'PENDING_PAYMENT' AND expires_at < CURRENT_TIMESTAMP
        RETURNING trip_id, num_seats;
      `;
      const result = await client.query(expireQuery);

      // 2. Re-add the seats back to the corresponding trips
      if (result.rows.length > 0) {
        for (const row of result.rows) {
          await client.query(
            'UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2',
            [row.num_seats, row.trip_id]
          );
        }
        this.logger.log(`Auto-expired ${result.rows.length} pending bookings and released seats.`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Auto-expiry job failed', error.stack);
    } finally {
      client.release();
    }
  }
}