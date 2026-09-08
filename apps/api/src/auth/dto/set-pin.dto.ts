import { THERAPIST_PIN } from '@vozaac/shared';
import { IsString, Matches } from 'class-validator';

export class SetPinDto {
  @IsString()
  @Matches(THERAPIST_PIN.pattern, {
    message: `El PIN debe tener ${THERAPIST_PIN.length} dígitos`,
  })
  pin: string;
}
