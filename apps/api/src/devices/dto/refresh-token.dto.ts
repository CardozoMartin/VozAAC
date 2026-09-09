import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  /** Token opaco de 64 hex; no es un JWT y no se decodifica. */
  @IsString()
  @Length(64, 64)
  refreshToken: string;
}
