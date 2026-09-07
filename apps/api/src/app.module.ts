import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/database.config';
import { CaregiversModule } from './caregivers/caregivers.module';
import { UsersModule } from './users/users.module';
import { BoardsModule } from './boards/boards.module';
import { CategoriesModule } from './categories/categories.module';
import { PictogramsModule } from './pictograms/pictograms.module';
import { AccessibilityModule } from './accessibility/accessibility.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El .env vive en la raíz del monorepo y lo comparten API y móvil.
      envFilePath: ['../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => buildDataSourceOptions(process.env),
    }),
    CaregiversModule,
    UsersModule,
    BoardsModule,
    CategoriesModule,
    PictogramsModule,
    AccessibilityModule,
    UsageModule,
  ],
})
export class AppModule {}
