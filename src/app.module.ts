import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    TripsModule, 
    BookingsModule, 
    PaymentsModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
