import {IsNotEmpty,IsObject,ValidateNested,IsUrl,IsString,IsNumber,IsPositive,IsBoolean,IsEnum, IsOptional, IsArray} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ObjectId, Types } from 'mongoose';
import { LectureDTO } from './lecture-course.dto';
  import { Transform } from 'class-transformer';

// Enum for defining primary language options
export enum PrimaryLanguage {
  EN = 'English',
  AR = 'Arabic',
  BOTH='Both'
}

// DTO for localized text fields (e.g., title, description)
export class LocalizedTextDto {
  @IsNotEmpty({ message: 'English text is required' })
  @IsString()
  en: string;

  @IsNotEmpty({ message: 'Arabic text is required' })
  @IsString()
  ar: string;
}

// DTO specifically for localized level fields
export class LocalizedLevelDto {
  @IsNotEmpty({ message: 'English level is required' })
  @IsString()
  en: string;

  @IsNotEmpty({ message: 'Arabic level is required' })
  @IsString()
  ar: string;
}

// Main DTO for creating a course
export class CreateCourseDto {
  // Course title in both languages
  @IsNotEmpty({ message: (args) => args.object['lang'] === 'ar' ? 'العنوان مطلوب' : 'Title is required' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  @ApiProperty()
  title: LocalizedTextDto;

  // Course category in both languages
  @IsString({ message: (args) => args.object['lang'] === 'ar' ? 'التصنيف مطلوب' : 'Category is required' })
  @ApiProperty()
  category: string|Types.ObjectId;

  // Course level in both languages
  @IsString({ message: (args) => args.object['lang'] === 'ar' ? 'المستوى مطلوب' : 'Level is required' })
  @ApiProperty()
  level: string|Types.ObjectId;

  // Primary language of the course: EN or AR
  @IsEnum(PrimaryLanguage, {
  message: (args) =>
    args.object['lang'] === 'ar'
      ? 'اللغة الأساسية غير صحيحة'
      : 'Invalid primary language',
})
@Transform(({ value }) => {
  if (!value) return PrimaryLanguage.EN;

  const val = value.toString().toLowerCase();

  if (val === 'en' || val === 'english') return PrimaryLanguage.EN;
  if (val === 'ar' || val === 'arabic') return PrimaryLanguage.AR;
  if (val === 'both' || val === 'كلاهما') return PrimaryLanguage.BOTH;

  return value; // fallback — may trigger validation error if not in enum
})
@ApiProperty({
  enum: PrimaryLanguage,
  description: 'Primary language of the course (EN, AR, BOTH)',
})
primaryLanguage: PrimaryLanguage;

  // Subtitle of the course
  @IsNotEmpty({ message: (args) => args.object['lang'] === 'ar' ? 'العنوان الفرعي مطلوب' : 'Subtitle is required' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  @ApiProperty()
  subtitle: LocalizedTextDto;

  // Description of the course
  @IsNotEmpty({ message: (args) => args.object['lang'] === 'ar' ? 'الوصف مطلوب' : 'Description is required' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  @ApiProperty()
  description: LocalizedTextDto;

  // Course image URL
  @IsString({ message: (args) => args.object['lang'] === 'ar' ? 'رابط الصورة مطلوب' : 'Image URL is required' })
  @IsUrl({}, { message: (args) => args.object['lang'] === 'ar' ? 'رابط الصورة غير صالح' : 'Image must be a valid URL' })
  @ApiProperty()
  image: string;

  // Welcome message shown to students
  @IsNotEmpty({ message: (args) => args.object['lang'] === 'ar' ? 'رسالة الترحيب مطلوبة' : 'Welcome message is required' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  @ApiProperty()
  welcomeMessage: LocalizedTextDto;

  // Course pricing (must be positive number)
  @Transform(({ value }) => {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(val) ? value : val;
  })
  @IsNumber({}, { message: (args) => args.object['lang'] === 'ar' ? 'السعر مطلوب' : 'Pricing is required' })
  @IsPositive({ message: (args) => args.object['lang'] === 'ar' ? 'يجب أن يكون السعر رقماً موجباً' : 'Pricing must be a positive number' })
  @ApiProperty()
  pricing: number;

  // Text describing course objectives
  @IsNotEmpty({ message: (args) => args.object['lang'] === 'ar' ? 'الأهداف مطلوبة' : 'Objectives are required' })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  @ApiProperty()
  objectives: LocalizedTextDto;

  // Whether the course is published or not
    @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsBoolean({ message: 'Published status is required' })
  isPublished: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LectureDTO)
  @ApiProperty({
    description: 'Optional array of lectures to be added during course creation',
    type: [LectureDTO],
  })
  lectures?: LectureDTO[];
}
