import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsCronService } from './bookings-cron.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCronService],
})
export class BookingsModule {}
