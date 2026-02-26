import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async seedTrips() {
    try {
      // 1. Check if we already have data
      const checkResult = await this.pool.query('SELECT COUNT(*) FROM trips');
      const count = parseInt(checkResult.rows[0].count, 10);

      if (count > 0) {
        this.logger.log(
          `Trips table already contains ${count} records. Skipping seed.`,
        );
        return;
      }

      this.logger.log('Seeding initial trip data...');

      // 2. Insert sample trips
      // Note: We omit 'id', 'created_at', and 'updated_at' because Postgres handles them automatically.
      const seedQuery = `
        INSERT INTO trips (
          title, destination, start_date, end_date, price, 
          max_capacity, available_seats, status, 
          refundable_until_days_before, cancellation_fee_percent
        )
        VALUES 
          ('Himalayan Base Camp Trek', 'Nepal', '2026-04-15 10:00:00+00', '2026-04-25 18:00:00+00', 1200.00, 15, 15, 'PUBLISHED', 15, 20.00),
          ('Goa Zen Retreat', 'India', '2026-03-10 09:00:00+00', '2026-03-15 17:00:00+00', 600.00, 20, 20, 'PUBLISHED', 7, 10.00),
          ('Kerala Backwaters Houseboat', 'India', '2026-05-01 12:00:00+00', '2026-05-05 10:00:00+00', 850.00, 10, 10, 'PUBLISHED', 10, 15.00),
          ('Draft Alps Ski Trip', 'Switzerland', '2026-12-01 08:00:00+00', '2026-12-10 20:00:00+00', 2500.00, 12, 12, 'DRAFT', 30, 50.00);
      `;

      await this.pool.query(seedQuery);
      this.logger.log('✓ Successfully seeded 3 trips.');
    } catch (error) {
      this.logger.error('Error seeding trips:', error.message);
    }
  }
}
