import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'user@example.com',
  })
  @IsString() // Minimum required decorator
  userEmail: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'Password@123',
  })
  @IsString() // Minimum required decorator
  password: string;
}