import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as entities from './entities';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { LeaveModule } from './leave/leave.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        entities: Object.values(entities).filter(
          (e) => typeof e === 'function',
        ),
        // Schema is created from the entities; fine for this project, use migrations in production.
        synchronize: true,
      }),
    }),
    AuthModule,
    LeaveModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
