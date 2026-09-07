import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
