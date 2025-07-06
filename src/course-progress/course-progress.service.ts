import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateCourseProgressDto } from './dto/create-course-progress.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CourseProgress } from './schemas/course-progress.schema';
import { JWTPayloadType } from 'utilitis/types';
import { Model, Types } from 'mongoose';
import { LectureProgres } from './schemas/lecture-progress.schema';
import { CourseService } from 'src/course/course.service';
import { StudentCourseService } from 'src/student-course/student-course.service';
import { Student } from 'src/student-course/schemas/student-course.schema';

function getLangMessage(lang: 'en' | 'ar' = 'en', messages: { ar: string; en: string }) {
  return messages[lang];
}

@Injectable()
export class CourseProgressService {
  constructor(
    @InjectModel(CourseProgress.name)private readonly courseProgress: Model<CourseProgress>,
    @InjectModel(LectureProgres.name)private readonly lectureProgress: Model<LectureProgres>,
    @InjectModel(Student.name)private readonly studentModel: Model<Student>,
    private readonly courseService:CourseService,
    private readonly studentCourseService: StudentCourseService,
  ) {}


    public async markLectureAsViewed(
      dto: CreateCourseProgressDto,
      userPayload: JWTPayloadType,
      lang: 'en' | 'ar' = 'en'
    ): Promise<CourseProgress> {
      lang=['en','ar'].includes(lang)?lang:'en';
      try {
        
        const { lectureId, courseId } = dto;

        await this.courseService.getCourseDetailsByID(courseId);

        let progress = await this.courseProgress.findOne({ userId: userPayload.id, courseId });

        if (!progress) {
          const newLecture = await this.lectureProgress.create({
            lectureId,
            viewed: true,
            dateViewed: new Date(),
            userId: userPayload.id,
          });

          progress = await this.courseProgress.create({
            userId: userPayload.id,
            courseId,
            LectureProgres: [newLecture._id],
          });
          await progress.save();

          const student = await this.studentModel.findOne({ userId: new Types.ObjectId(userPayload.id) });
          if (student) {
            const hasCourse = student.courses.some((c) => c.idCourses.includes(courseId));
            if (!hasCourse) {
              student.courses.push({
                dateOfPurchase: new Date(),
                idCourses: [courseId],
                ViewAt: new Date(),
              });
              await student.save();
            }
          }
        } else {
          const existingLecture = await this.lectureProgress.findOne({
            _id: { $in: progress.LectureProgres },
            lectureId,
            userId: userPayload.id,
          });

          if (existingLecture) {
            existingLecture.viewed = true;
            existingLecture.dateViewed = new Date();
            await existingLecture.save();
          } else {
            const newLecture = await this.lectureProgress.create({
              lectureId,
              viewed: true,
              dateViewed: new Date(),
              userId: userPayload.id,
            });
            progress.LectureProgres.push(newLecture._id);
          }

          await progress.save();

          const lectures = await this.lectureProgress.find({ _id: { $in: progress.LectureProgres } });
          const course = await this.courseService.getCourseDetailsByID(courseId);
          const allViewed =
            progress.LectureProgres.length === course.curriculum.length &&
            lectures.every((lec) => lec.viewed);

          if (allViewed) {
            progress.completed = true;
            progress.completionDate = new Date();
            await progress.save();
          }
        }

        return progress;
      } catch (err) {
        console.error('Error in markLectureAsViewed:', err.message);
        throw new InternalServerErrorException(getLangMessage(lang, {
          en: 'Could not mark lecture as viewed',
          ar: 'تعذر تسجيل مشاهدة المحاضرة',
        }));
      }
    }

    public async getCurrentCourseProgress(
      courseId: Types.ObjectId,
      currentUser: JWTPayloadType,
      page: number = 1,
      limit: number = 10,
      lang: 'en' | 'ar' = 'en'
    ): Promise<any> {
      lang=['en','ar'].includes(lang)?lang:'en';
      try {
        page = Math.max(1, page);
        limit = Math.min(Math.max(1, limit), 100);

        const studentRecord = await this.studentCourseService.getStudent(currentUser.id);
        const purchased = studentRecord.courses.find(entry => entry.idCourses.includes(courseId));

        if (!purchased) {
          return {
            isPurchased: false,
            message: getLangMessage(lang, {
              en: 'You need to purchase this course to access it.',
              ar: 'يجب عليك شراء هذه الدورة للوصول إليها.',
            }),
          };
        }

        const progress = await this.courseProgress.findOne({ userId: currentUser.id, courseId });

        const courseDetails = await this.courseService.getCourseDetailsByID(courseId);
        if (!courseDetails) {
          throw new NotFoundException(getLangMessage(lang, {
            en: 'Course not found',
            ar: 'لم يتم العثور على الدورة',
          }));
        }

        if (!progress || progress.LectureProgres.length === 0) {
          return {
            message: getLangMessage(lang, {
              en: 'No progress found, you can start watching the course.',
              ar: 'لم يتم العثور على تقدم، يمكنك البدء بمشاهدة الدورة.',
            }),
            data: {
              courseDetails,
              progress: [],
              isPurchased: true,
            },
          };
        }

        const lecturesProgress = progress.LectureProgres;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLectures = lecturesProgress.slice(startIndex, endIndex);

        return {
          data: {
            courseDetails,
            progress: paginatedLectures,
            completed: progress.completed,
            completionDate: progress.completionDate,
            isPurchased: true,
            pagination: {
              totalLectures: lecturesProgress.length,
              totalPages: Math.ceil(lecturesProgress.length / limit),
              currentPage: page,
              perPage: limit,
            },
          },
        };
      } catch (err) {
        console.error('Error in getCurrentCourseProgress:', err.message);
        throw new InternalServerErrorException(getLangMessage(lang, {
          en: 'Could not fetch course progress',
          ar: 'تعذر جلب تقدم الدورة',
        }));
      }
    }

    public async resetCurrentCourseProgress(
      courseId: string,
      userId: string | Types.ObjectId,
      lang: 'en' | 'ar' = 'en'
    ): Promise<any> {
      lang=['en','ar'].includes(lang)?lang:'en';
      try {
        const progress = await this.courseProgress.findOne({ courseId, userId });
        if (!progress) {
          return {
            message: getLangMessage(lang, {
              en: 'Progress not found!',
              ar: 'لم يتم العثور على تقدم!',
            }),
          };
        }

        progress.LectureProgres = [];
        progress.completed = false;
        progress.completionDate = null;
        await progress.save();

        return {
          message: getLangMessage(lang, {
            en: 'Course progress has been reset',
            ar: 'تمت إعادة تعيين تقدم الدورة',
          }),
          data: progress,
        };
      } catch (err) {
        console.error('Error in resetCurrentCourseProgress:', err.message);
        throw new InternalServerErrorException(getLangMessage(lang, {
          en: 'Could not reset course progress',
          ar: 'تعذر إعادة تعيين تقدم الدورة',
        }));
      }
    }
  
}