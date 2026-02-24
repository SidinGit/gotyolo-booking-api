import { Global, Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { SORTED_SCHEMAS } from './schema-registry';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => new Pool({
        connectionString: configService.get<string>('DATABASE_URL'),
      }),
    },
  ],
  exports: ['DATABASE_POOL'],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async onModuleInit() {
    this.logger.log('Executing agnostic database synchronization...');

    for (const schema of SORTED_SCHEMAS) {
      try {
        if (schema.setup) await this.pool.query(schema.setup);
        await this.pool.query(schema.table);
        this.logger.log(`✓ Initialized: ${schema.name}`);
      } catch (e) {
        this.logger.error(`✗ Failed to initialize ${schema.name}: ${e.message}`);
        throw e;
      }
    }
    this.logger.log('Database synchronization complete.');
  }
}