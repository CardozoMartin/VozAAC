import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // La app móvil corre en otro origen durante el desarrollo con Expo.
  app.enableCors();

  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);
  console.log(`VozAAC API escuchando en http://localhost:${port}/api`);
}

void bootstrap();
