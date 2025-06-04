import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from "class-validator";




export class ResetPasswordDto {
    
    @IsNotEmpty({message: 'Password is required'})
    @MaxLength(250)
    @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, { 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'})
    @IsString({message:'Password must be a string'})
    @Length(8, 250, {message: 'Password must be at least 8 characters long and contaions small and capital letters and numbers and special characters'})
    newPassword: string;

    @IsNotEmpty({message: 'User Email is required'})
    @MaxLength(250,{ message: 'Password must not exceed 250 characters' })
    @IsString({message:'User Email must be a string'})
    @IsEmail({},{message:'User Email must be a valid email'})
    @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/ ,{message:'User Email must be a valid email'})
    userEmail:string;

    @IsNotEmpty({message: 'Password is required'})
    @MaxLength(250)
    @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, { 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'})
    @IsString({message:'Password must be a string'})
    @Length(8, 250, {message: 'Password must be at least 8 characters long and contaions small and capital letters and numbers and special characters'})
    RestPasswordToken:string;
}