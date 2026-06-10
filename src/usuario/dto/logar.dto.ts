import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LogarDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  senha!: string;

  @IsNotEmpty()
  @IsString()
  captchaResponse!: string;
}
