import { Injectable, NotFoundException, InternalServerErrorException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, HydratedDocument } from 'mongoose';
import { CourseService } from '../course/course.service';
import { Student } from './schemas/student-course.schema';
import { JWTPayloadType } from 'utilitis/types';
import { Order } from '../order/schema/order.schema';
import { Course } from '../course/schemas/course.schema';
import { Request } from 'express';
import { User } from 'src/user/schemas/user.schema';

function getLangMessage(lang: 'en' | 'ar' = 'en', messages: { ar: string; en: string }) {
  return messages[lang];
}

/**
 * Service for managing student–course relationships:
 * - student record creation
 * - querying purchased courses
 * - checking purchase status
 * - adding courses after order
 * - listing courses for a student
 */
@Injectable()
export class StudentCourseService {
  constructor(
    @InjectModel(Student.name) private readonly studentModel: Model<Student>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(forwardRef(() => CourseService)) private readonly courseService: CourseService,
  ) {}
  public async enrollStudentInCourse(
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
) {
  // ✅ جلب المستخدم والطالب
  const [user, student] = await Promise.all([
    this.userModel.findById(userId),
    this.studentModel.findOne({ userId }),
  ]);

  if (!user) {
    throw new NotFoundException('User not found');
  }

  let updatedStudent = student;

  // ✅ إنشاء سجل الطالب إذا غير موجود
  if (!student) {
    updatedStudent = new this.studentModel({
      userId,
      courses: [{
        idCourses: [courseId],
        dateOfPurchase: new Date(),
        ViewAt: null,
      }],
    });
  } else {
    const alreadyEnrolled = student.courses.some(entry =>
      entry.idCourses.includes(courseId)
    );

    if (!alreadyEnrolled) {
      student.courses.push({
        idCourses: [courseId],
        dateOfPurchase: new Date(),
        ViewAt: null,
      });
    }
  }

  // ✅ حفظ الطالب
  await updatedStudent.save();

  // ✅ تحديث الكورس ليحتوي الطالب
  await this.courseModel.findByIdAndUpdate(courseId, {
    $addToSet: { students: updatedStudent._id },
  });

  // ✅ تحديث user.enrolledCourses
  await this.userModel.updateOne(
    { _id: userId },
    { $addToSet: { enrolledCourses: courseId } }
  );

  return {
    message: 'Student enrolled successfully',
    student: updatedStudent,
  };
}

  public async getStudent(userId: string | Types.ObjectId, lang: 'en' | 'ar' = 'en') {
    lang=['en','ar'].includes(lang)?lang:'en';
    const _userId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const student = await this.studentModel.findOne({ userId: _userId });

    if (!student) {
      throw new NotFoundException(
        getLangMessage(lang, {
          en: 'Student not found',
          ar: 'الطالب غير موجود',
        }),
      );
    }

    return student;
  }

  public async AddStudent(userId: Types.ObjectId) {
    const student = await this.studentModel.create({ userId, courses: [] });
    console.log('→ Created student doc:', student);
    return student;
  }

  public async getAllStudentViewCourses(
    category?: string,
    level?: string,
    primaryLanguage?: string,
    sortBy: string = 'price-lowtohigh',
    page: number = 1,
    limit: number = 10,
  ): Promise<{ totalCourses: number; currentPage: number; totalPages: number; data: any[] }> {
    const skip = (page - 1) * limit;

    const filter: any = { isPublished: true };
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (primaryLanguage) filter.primaryLanguage = primaryLanguage;

    let sortOption: any = {};
    switch (sortBy) {
      case 'price-lowtohigh':
        sortOption.price = 1;
        break;
      case 'price-hightolow':
        sortOption.price = -1;
        break;
      case 'newest':
        sortOption.createdAt = -1;
        break;
      case 'oldest':
        sortOption.createdAt = 1;
        break;
      default:
        sortOption.price = 1;
        break;
    }

    const [courses, totalCourses] = await Promise.all([
      this.courseModel.find(filter).sort(sortOption).skip(skip).limit(limit).exec(),
      this.courseModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCourses / limit);

    return {
      totalCourses,
      currentPage: page,
      totalPages,
      data: courses,
    };
  }

  public async getStudentViewCourseDetails(id: Types.ObjectId): Promise<Course> {
    return await this.courseService.getCourseDetailsByID(id);
  }

  public async checkCoursePurchaseInfo(
  courseId: Types.ObjectId,
  user: JWTPayloadType,
  lang: 'en' | 'ar' = 'en',
) {
  lang = ['en', 'ar'].includes(lang) ? lang : 'en';

  const userObjectId = new Types.ObjectId(user.id);

  // ❗ نحصل على الطالب
  const student = await this.studentModel.findOne({ userId: userObjectId }).lean();
  if (!student) {
    throw new NotFoundException(
      getLangMessage(lang, {
        en: 'Student not found',
        ar: 'الطالب غير موجود',
      }),
    );
  }

  const studentIdStr = student._id.toString();
  const courseIdStr = courseId.toString();

  // ❗ التحقق من جهة الكورس
  const course = await this.courseModel
    .findById(courseId)
    .select('students')
    .lean();

  const isInCourse =
    course?.students?.some((std) => std?.toString?.() === studentIdStr) ?? false;

  // ❗ التحقق الإضافي من جهة الطالب (احتياطي)
  const isInStudent = student.courses?.some((c) =>
    c.idCourses?.some((id) => id?.toString?.() === courseIdStr),
  );

  const purchased = isInCourse || isInStudent;

  return {
    purchased,
    message: getLangMessage(lang, {
      en: purchased
        ? 'Course already purchased by student'
        : 'Course not purchased by this student',
      ar: purchased
        ? 'تم شراء هذه الدورة مسبقًا'
        : 'لم يقم الطالب بشراء هذه الدورة',
    }),
  };
}
  public async UpdateStudentCourses(order: HydratedDocument<Order>) {
    let studentCourse = await this.studentModel.findOne({ userId: order.userId });

    if (studentCourse) {
      studentCourse.courses.push({
        dateOfPurchase: new Date(),
        idCourses: [order._id],
        ViewAt: new Date(),
      });
      await studentCourse.save();
    } else {
      studentCourse = new this.studentModel({
        userId: order.userId,
        courses: [{
          dateOfPurchase: new Date(),
          idCourses: [order._id],
        }],
      });
      await studentCourse.save();
    }
  }

  public async getAllCoursesForCurrentStudent(
  idStudent: string | Types.ObjectId,
  payloadUser: JWTPayloadType,
   lang: 'en' | 'ar' = 'en'
) {
  lang=['en','ar'].includes(lang)?lang:'en';
  try {
    const studentId =
      payloadUser.userType === 'admin'
        ? idStudent
        : new Types.ObjectId(payloadUser.id);

    const student = await this.studentModel
      .findOne({ userId: studentId })
      .populate('courses.idCourses');

    if (!student) {
      throw new NotFoundException(
        getLangMessage(lang, {
          en: 'Student not found',
          ar: 'الطالب غير موجود',
        }),
      );
    }

    return { success: true, data: student.courses };
  } catch (error) {
    console.error('Error in getAllCoursesForCurrentStudent:', error);
    throw new InternalServerErrorException(
      getLangMessage(lang, {
        en: 'An error occurred while fetching courses',
        ar: 'حدث خطأ أثناء جلب الدورات',
      }),
    );
  }
  }

  public async getOrCreateStudent(userId: Types.ObjectId): Promise<Student> {
    let student = await this.studentModel.findOne({ userId });
    if (!student) {
      student = await this.studentModel.create({ userId, courses: [] });
    }
    return student;
  }

}