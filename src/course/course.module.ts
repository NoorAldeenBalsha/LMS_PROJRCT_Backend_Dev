import { forwardRef, Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { DatabaseModule } from 'src/db/database.module';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { Lecture, LectureSchema } from './schemas/lecture.schema';
import {AutoIncrementID,AutoIncrementIDOptions,} from '@typegoose/auto-increment';
import { CourseProgress, CourseProgressSchema } from 'src/course-progress/schemas/course-progress.schema';
import { Student, StudentCourseSchema } from '../student-course/schemas/student-course.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Level, LevelSchema } from './schemas/level.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

@Module({
  controllers: [CourseController],
  providers: [CourseService],
  imports: [
    MongooseModule.forFeature([
      { 
        name: Course.name, 
        schema: CourseSchema 
      },
      { 
        name: CourseProgress.name, 
        schema: CourseProgressSchema 
      },
      { 
        name: Student.name, 
        schema: StudentCourseSchema 
      },
      { 
        name: Category.name, 
        schema: CategorySchema 
      },
      { 
        name: Level.name, 
        schema: LevelSchema 
      },
      { 
        name: User.name, 
        schema: UserSchema 
      },
    ]),
    DatabaseModule,
    MongooseModule.forFeatureAsync([      {
        name: Lecture.name,
        useFactory: () => {
          const schema = LectureSchema;
          schema.plugin(AutoIncrementID, {
            field: 'public_id',
            startAt: 1,
          } satisfies AutoIncrementIDOptions);
          return schema;
        },
        inject: [getConnectionToken()],
      },
    ]),
    forwardRef(() => UserModule),
    JwtModule,
  ],
  exports: [CourseService]
})
export class CourseModule {}