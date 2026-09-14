import { Module } from '@nestjs/common';
import { ArasaacService } from './arasaac.service';
import { ArasaacController } from './arasaac.controller';

@Module({
  controllers: [ArasaacController],
  providers: [ArasaacService],
  exports: [ArasaacService],
})
export class ArasaacModule {}
