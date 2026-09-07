import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
