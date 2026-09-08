import { resolve } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { CaregiversModule } from './caregivers/caregivers.module';
import { UsersModule } from './users/users.module';
import { BoardsModule } from './boards/boards.module';
import { CategoriesModule } from './categories/categories.module';
import { PictogramsModule } from './pictograms/pictograms.module';
import { AccessibilityModule } from './accessibility/accessibility.module';
import { UsageModule } from './usage/usage.module';
import { UploadsModule } from './uploads/uploads.module';
import { ArasaacModule } from './arasaac/arasaac.module';

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
    // Las imágenes y audios subidos se sirven como estáticos bajo /uploads.
    // Quedan fuera del prefijo /api porque son archivos, no endpoints.
    ServeStaticModule.forRoot({
      rootPath: resolve(process.env.UPLOAD_DIR ?? './uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    CaregiversModule,
    UsersModule,
    BoardsModule,
    CategoriesModule,
    PictogramsModule,
    AccessibilityModule,
    UsageModule,
    UploadsModule,
    ArasaacModule,
  ],
})
export class AppModule {}
