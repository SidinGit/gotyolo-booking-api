import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { AdminTripsController } from './admin-trips.controller';

@Module({
  controllers: [TripsController, AdminTripsController],
  providers: [TripsService],
})
export class TripsModule {}
