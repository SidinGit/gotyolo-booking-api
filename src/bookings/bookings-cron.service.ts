import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';

@Injectable()
export class BookingsCronService {
  private readonly logger = new Logger(BookingsCronService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  // This will run automatically every 1 minute
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredBookings() {
    this.logger.debug('Running background check for expired bookings...');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Find all expired bookings and lock them.
      // SKIP LOCKED means if another background worker is already looking at a row,
      // this query will just skip it instead of waiting, preventing deadlocks.
      const findQuery = `
        SELECT id, trip_id, num_seats 
        FROM bookings 
        WHERE state = 'PENDING_PAYMENT' 
          AND expires_at <= CURRENT_TIMESTAMP
        FOR UPDATE SKIP LOCKED;
      `;

      const { rows: expiredBookings } = await client.query(findQuery);

      if (expiredBookings.length === 0) {
        await client.query('COMMIT');
        return; // Nothing to expire
      }

      this.logger.log(
        `Found ${expiredBookings.length} expired bookings. Reclaiming seats...`,
      );

      // 2. Loop through and expire them, returning the seats to the trip
      for (const booking of expiredBookings) {
        // Mark as EXPIRED
        await client.query(
          `UPDATE bookings SET state = 'EXPIRED' WHERE id = $1`,
          [booking.id],
        );

        // Return the seats back to the trip's available pool
        await client.query(
          `UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2`,
          [booking.num_seats, booking.trip_id],
        );
      }

      await client.query('COMMIT');
      this.logger.log('Successfully reclaimed seats for expired bookings.');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to process expired bookings', error.stack);
    } finally {
      client.release();
    }
  }
}
