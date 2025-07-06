import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCourseDto, PrimaryLanguage } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import { Course } from './schemas/course.schema';
import { UserService } from 'src/user/user.service';
import { Lecture } from './schemas/lecture.schema';
import { Order } from 'src/order/schema/order.schema';
import { Student } from 'src/student-course/schemas/student-course.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Level } from './schemas/level.schema';
import mongoose from 'mongoose';

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Level.name) private readonly levelModel: Model<Level>,
    @InjectModel(Student.name) private readonly studentModel: Model<Student>,

    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @InjectModel(Lecture.name) private readonly lectureModel: Model<Lecture>,
  ) {}

  // Add a new course by instructor
  // Validates instructor, creates course, links course to instructor
  public async AddNewCourse(
    createCourseDto: CreateCourseDto,
    instructorId: Types.ObjectId,
    lang: 'en' | 'ar' = 'en',
  ) {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    const user = await this.userService.getCurrentUserDocument(
      instructorId,
      lang,
    );
    if (!user) {
      const message = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
      throw new NotFoundException(message);
    }

    let categoryId: Types.ObjectId | null = null;
    if (Types.ObjectId.isValid(createCourseDto.category)) {
      categoryId = new Types.ObjectId(createCourseDto.category);
    } else {
      const category = await this.categoryModel.findOne({
        $or: [
          { 'title.en': createCourseDto.category },
          { 'title.ar': createCourseDto.category },
        ],
      });
      if (!category) {
        const message =
          lang === 'ar' ? 'التصنيف غير موجود' : 'Category not found';
        throw new NotFoundException(message);
      }
      categoryId = category._id as Types.ObjectId;
    }

    let levelId: Types.ObjectId | null = null;
    if (Types.ObjectId.isValid(createCourseDto.level)) {
      levelId = new Types.ObjectId(createCourseDto.level);
    } else {
      const level = await this.levelModel.findOne({
        $or: [
          { 'title.en': createCourseDto.level },
          { 'title.ar': createCourseDto.level },
        ],
      });
      if (!level) {
        const message = lang === 'ar' ? 'المستوى غير موجود' : 'Level not found';
        throw new NotFoundException(message);
      }
      levelId = level._id as Types.ObjectId;
    }

    const toLowerObject = (obj: { en: string; ar: string }) => ({
      en: obj.en.toLowerCase(),
      ar: obj.ar.toLowerCase(),
    });

    try {
      const lectureIds: Types.ObjectId[] = [];

      if (createCourseDto.lectures && createCourseDto.lectures.length > 0) {
        for (const lectureDto of createCourseDto.lectures) {
          const lecture = await this.lectureModel.create({
            ...lectureDto,
            title: toLowerObject(lectureDto.title),
          });
          lectureIds.push(lecture._id);
        }
      }

      const newCourse = await this.courseModel.create({
        instructorId,
        instructorName: user.userName,
        title: toLowerObject(createCourseDto.title),
        description: toLowerObject(createCourseDto.description),
        welcomeMessage: toLowerObject(createCourseDto.welcomeMessage),
        subtitle: toLowerObject(createCourseDto.subtitle),
        objectives: toLowerObject(createCourseDto.objectives),
        category: categoryId,
        level: levelId,
        curriculum: lectureIds,
        image: createCourseDto.image || '',
        pricing: createCourseDto.pricing,
        isPublished: createCourseDto.isPublished ?? false,
        primaryLanguage: createCourseDto.primaryLanguage,
      });

      user.enrolledCourses.push(newCourse._id);
      await user.save();

      return {
        statusCode: 201,
        message:
          lang === 'ar'
            ? 'تم إنشاء الدورة بنجاح'
            : 'Course created successfully',
      };
    } catch (error) {
      console.error(error);
      const message =
        lang === 'ar'
          ? 'حدث خطأ أثناء إنشاء الدورة'
          : 'An error occurred while creating the course';
      throw new InternalServerErrorException(message);
    }
  }
  //============================================================================
  // Get all courses with filters, sorting, pagination, and role-based access

  public async getAllCourses(
    category?: string | string[],
    level?: string | string[],
    primaryLanguage?: string,
    sortBy: string = 'price-lowtohigh',
    page: number = 1,
    limit: number = 10,
    useFilter: boolean = false,
    lang: 'en' | 'ar' = 'en',
    user?: any,
  ): Promise<{
    totalCourses: number;
    totalPages: number;
    currentPage: number;
    courses: any[];
  }> {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    const finalFilter: any = {};

    
    if (category) {
      const categoryArray = Array.isArray(category)
        ? category
        : category.split(',');
      finalFilter.category = {
        $in: categoryArray.map((id) => new Types.ObjectId(id)),
      };
    }

    
    if (level) {
      const levelArray = Array.isArray(level) ? level : level.split(',');
      finalFilter.level = {
        $in: levelArray.map((id) => new Types.ObjectId(id)),
      };
    }

    
    if (primaryLanguage) {
      finalFilter.primaryLanguage = primaryLanguage;
    }

    
    let sortParam: any = {};
    switch (sortBy) {
      case 'price-lowtohigh':
        sortParam = { pricing: 1 };
        break;
      case 'price-hightolow':
        sortParam = { pricing: -1 };
        break;
      case 'title-atoz':
        sortParam = { [`title.${lang}`]: 1 };
        break;
      case 'title-ztoa':
        sortParam = { [`title.${lang}`]: -1 };
        break;
      default:
        sortParam = { pricing: 1 };
    }

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, limit);
    const skip = (validatedPage - 1) * validatedLimit;

    const totalCourses = await this.courseModel.countDocuments(finalFilter);

    const courses = await this.courseModel
      .find(finalFilter)
      .populate('category', 'title')
      .populate('level', 'title')
      .populate({
        path: 'students',
        populate: {
          path: 'userId',
          model: 'User',
          select: '_id userName userEmail gender',
        },
      })
      .sort(sortParam)
      .skip(skip)
      .limit(limit)
      .exec();

    const localizedCourses = courses.map((course) => {
      const obj = course.toObject();

      const categoryTitle =
        obj.category &&
        typeof obj.category !== 'string' &&
        'title' in obj.category
          ? obj.category.title
          : {};

      const levelTitle =
        obj.level && typeof obj.level !== 'string' && 'title' in obj.level
          ? obj.level.title
          : {};

      const formattedStudents = (obj.students || [])
        .map((student: any) => {
          const user = student.userId;
          if (!user) return null;

          return {
            _id: user._id,
            userName: user.userName,
            userEmail: user.userEmail,
            gender: user.gender,
          };
        })
        .filter(Boolean);

      const isStudent = user?.role === 'student';

      if (isStudent) {
        return {
          ...obj,
          title: obj.title?.[lang] ?? '',
          description: obj.description?.[lang] ?? '',
          subtitle: obj.subtitle?.[lang] ?? '',
          welcomeMessage: obj.welcomeMessage?.[lang] ?? '',
          objectives: obj.objectives?.[lang] ?? '',
          level: levelTitle?.[lang] ?? '',
          category: categoryTitle?.[lang] ?? '',
          students: formattedStudents,
          createdAt:
            (obj as any).createdAt ?? obj._id?.getTimestamp?.() ?? null,
        };
      } else {
        return {
          ...obj,
          title: obj.title ?? {},
          description: obj.description ?? {},
          subtitle: obj.subtitle ?? {},
          welcomeMessage: obj.welcomeMessage ?? {},
          objectives: obj.objectives?.[lang] ?? '',
          level: levelTitle ?? {},
          category: categoryTitle ?? {},
          students: formattedStudents,
          createdAt:
            (obj as any).createdAt ?? obj._id?.getTimestamp?.() ?? null,
        };
      }
    });

    return {
      totalCourses,
      totalPages: Math.ceil(totalCourses / limit),
      currentPage: page,
      courses: localizedCourses,
    };
  }
  //============================================================================
  // Get all courses  sorting, pagination, and role-based access
  public async getAllCoursesNoFilter(
    sortBy: string = 'price-lowtohigh',
    page: number = 1,
    limit: number = 10,
    lang: 'en' | 'ar' = 'en',
    categoryIds?: string,
    levelIds?: string,
  ): Promise<{
    totalCourses: number;
    totalPages: number;
    currentPage: number;
    courses: any[];
  }> {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    const finalFilter: any = {};

    if (categoryIds) {
      const categoryArray = categoryIds
        .split(',')
        .map((id) => new Types.ObjectId(id.trim()));
      finalFilter.category = { $in: categoryArray };
    }

    if (levelIds) {
      const levelArray = levelIds
        .split(',')
        .map((id) => new Types.ObjectId(id.trim()));
      finalFilter.level = { $in: levelArray };
    }

    let sortParam: any = {};
    switch (sortBy) {
      case 'price-lowtohigh':
        sortParam = { pricing: 1 };
        break;
      case 'price-hightolow':
        sortParam = { pricing: -1 };
        break;
      case 'title-atoz':
        sortParam = { [`title.${lang}`]: 1 };
        break;
      case 'title-ztoa':
        sortParam = { [`title.${lang}`]: -1 };
        break;
      default:
        sortParam = { pricing: 1 };
    }

    const skip = (page - 1) * limit;
    const totalCourses = await this.courseModel.countDocuments(finalFilter);

    const courses = await this.courseModel
      .find(finalFilter)
      .populate('category', 'title')
      .populate('level', 'title')
      .populate({
        path: 'students',
        populate: {
          path: 'userId',
          model: 'User',
          select: '_id userName userEmail gender',
        },
      })
      .sort(sortParam)
      .skip(skip)
      .limit(limit)
      .exec();

    const localizedCourses = courses.map((course) => {
      const obj = course.toObject();

      const categoryTitle =
        obj.category &&
        typeof obj.category !== 'string' &&
        'title' in obj.category
          ? (obj.category.title?.[lang] ?? '')
          : '';

      const levelTitle =
        obj.level && typeof obj.level !== 'string' && 'title' in obj.level
          ? (obj.level.title?.[lang] ?? '')
          : '';

      const formattedStudents = (obj.students || [])
        .map((student: any) => {
          const user = student.userId;
          if (!user) return null;
          return {
            _id: user._id,
            userName: user.userName,
            userEmail: user.userEmail,
            gender: user.gender,
          };
        })
        .filter(Boolean);

      return {
        ...obj,
        title: obj.title?.[lang] ?? '',
        description: obj.description?.[lang] ?? '',
        subtitle: obj.subtitle?.[lang] ?? '',
        welcomeMessage: obj.welcomeMessage?.[lang] ?? '',
        level: levelTitle,
        category: categoryTitle,
        objectives: obj.objectives?.[lang] ?? '',
        students: formattedStudents,
        createdAt: (obj as any).createdAt ?? obj._id?.getTimestamp?.() ?? null,
      };
    });

    return {
      totalCourses,
      totalPages: Math.ceil(totalCourses / limit),
      currentPage: page,
      courses: localizedCourses,
    };
  }
  //============================================================================
  // Get course details by ID with localization
  public async getCourseDetailsByID(
    id: Types.ObjectId,
    lang: 'en' | 'ar' = 'en',
    user?: any,
    categoryIds?: string[],
    levelIds?: string[],
    sortBy: string = 'price-lowtohigh',
  ): Promise<any> {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    let role = 'guest';

    if (user?.id) {
      const currentUser = await this.userService.getCurrentUserDocument(
        user.id,
      );
      role = currentUser?.role ?? 'guest';
    }

    const isStudent = role === 'student';

    const filter: any = { _id: id };

    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      filter.category = {
        $in: categoryIds.map((id) => new Types.ObjectId(id)),
      };
    }

    if (Array.isArray(levelIds) && levelIds.length > 0) {
      filter.level = { $in: levelIds.map((id) => new Types.ObjectId(id)) };
    }

    let sortParam: any = {};
    switch (sortBy) {
      case 'price-lowtohigh':
        sortParam = { pricing: 1 };
        break;
      case 'price-hightolow':
        sortParam = { pricing: -1 };
        break;
      case 'title-atoz':
        sortParam = { [`title.${lang}`]: 1 };
        break;
      case 'title-ztoa':
        sortParam = { [`title.${lang}`]: -1 };
        break;
      default:
        sortParam = { pricing: 1 };
    }

    const courseDetails = (await this.courseModel
      .findOne(filter)
      .sort(sortParam)
      .populate('curriculum')
      .populate('category')
      .populate('level')
      .populate({
        path: 'students',
        populate: {
          path: 'userId',
          model: 'User',
          select: '_id userName userEmail gender',
        },
      })) as any;

    if (!courseDetails) {
      const message = lang === 'ar' ? 'الكورس غير موجود' : 'Course not found';
      throw new NotFoundException(message);
    }

    const getLocalizedValue = (field: any) => {
      return typeof field === 'object' ? (field?.[lang] ?? '') : '';
    };

    const getLocalizedArray = (arr: any[]) => {
      return Array.isArray(arr) ? arr.map((obj) => obj?.[lang] ?? '') : [];
    };

    const formattedStudents = (courseDetails.students ?? [])
      .map((student: any) => {
        const user = student.userId;
        if (!user || typeof user !== 'object') return null;
        return {
          _id: user._id,
          userName: user.userName,
          userEmail: user.userEmail,
          gender: user.gender,
        };
      })
      .filter(Boolean);

    const baseResponse = {
      _id: courseDetails._id,
      instructorId: courseDetails.instructorId,
      instructorName: courseDetails.instructorName,
      image: courseDetails.image,
      primaryLanguage: courseDetails.primaryLanguage,
      pricing: courseDetails.pricing,
      curriculum: courseDetails.curriculum,
      students: formattedStudents,
      isPublished: courseDetails.isPublished,
      ...(courseDetails.createdAt
        ? { createdAt: courseDetails.createdAt }
        : {}),
    };

    if (isStudent) {
      return {
        ...baseResponse,
        title: getLocalizedValue(courseDetails.title),
        category: getLocalizedValue(courseDetails.category?.title),
        level: getLocalizedValue(courseDetails.level?.title),
        subtitle: getLocalizedValue(courseDetails.subtitle),
        description: getLocalizedValue(courseDetails.description),
        welcomeMessage: getLocalizedValue(courseDetails.welcomeMessage),
        objectives: getLocalizedArray(courseDetails.objectives),
      };
    }

    return {
      ...baseResponse,
      title: courseDetails.title ?? { en: '', ar: '' },
      category: courseDetails.category?.title ?? { en: '', ar: '' },
      level: courseDetails.level?.title ?? { en: '', ar: '' },
      subtitle: courseDetails.subtitle ?? { en: '', ar: '' },
      description: courseDetails.description ?? { en: '', ar: '' },
      welcomeMessage: courseDetails.welcomeMessage ?? { en: '', ar: '' },
      objectives: courseDetails.objectives ?? { en: '', ar: '' },
    };
  }
  //============================================================================
  // Update course by ID if instructor is authorized
  public async updateCourseByID(
    id: Types.ObjectId,
    updateCourseDto: UpdateCourseDto,
    instructorId: Types.ObjectId,
    lang: 'en' | 'ar' = 'en',
  ) {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';
    const course = await this.courseModel.findById(id);
    if (!course) {
      const message = lang === 'ar' ? 'الكورس غير موجود' : 'Course not found';
      throw new NotFoundException(message);
    }

    if (course.instructorId.toString() !== instructorId.toString()) {
      const message =
        lang === 'ar'
          ? 'لست مخولًا لتحديث هذه الدورة'
          : 'You are not authorized to update this course';
      throw new UnauthorizedException(message);
    }

    try {
      //==================categories
      if (updateCourseDto.category) {
        const newCategory = (await this.categoryModel.findOne({
          $or: [
            { 'title.en': updateCourseDto.category },
            { 'title.ar': updateCourseDto.category },
          ],
        })) as HydratedDocument<Category>;

        if (!newCategory) {
          const message =
            lang === 'ar' ? 'التصنيف غير موجود' : 'Category not found';
          throw new NotFoundException(message);
        }

        updateCourseDto.category = newCategory._id;
      }
      //==================levels
      if (updateCourseDto.level) {
        const newLevel = (await this.levelModel.findOne({
          $or: [
            { 'title.en': updateCourseDto.level },
            { 'title.ar': updateCourseDto.level },
          ],
        })) as HydratedDocument<Level>;

        if (!newLevel) {
          const message =
            lang === 'ar' ? 'المستوى غير موجود' : 'Level not found';
          throw new NotFoundException(message);
        }

        updateCourseDto.level = newLevel._id as Types.ObjectId;
      }

      //  This one for lecture
      if (updateCourseDto.lectures && updateCourseDto.lectures.length > 0) {
        for (const lectureDto of updateCourseDto.lectures) {
          const newLecture = await this.lectureModel.create({
            ...lectureDto,
            title: {
              en: lectureDto.title.en.toLowerCase(),
              ar: lectureDto.title.ar.toLowerCase(),
            },
          });
          course.curriculum.push(newLecture._id);
        }
        await course.save();
      }

      const updatedCourse = await this.courseModel.findByIdAndUpdate(
        id,
        {
          ...updateCourseDto,
          title: {
            en: updateCourseDto.title?.en?.toLowerCase() ?? course.title.en,
            ar: updateCourseDto.title?.ar?.toLowerCase() ?? course.title.ar,
          },
          description: {
            en:
              updateCourseDto.description?.en?.toLowerCase() ??
              course.description.en,
            ar:
              updateCourseDto.description?.ar?.toLowerCase() ??
              course.description.ar,
          },
          welcomeMessage: {
            en:
              updateCourseDto.welcomeMessage?.en?.toLowerCase() ??
              course.welcomeMessage.en,
            ar:
              updateCourseDto.welcomeMessage?.ar?.toLowerCase() ??
              course.welcomeMessage.ar,
          },
          subtitle: {
            en:
              updateCourseDto.subtitle?.en?.toLowerCase() ?? course.subtitle.en,
            ar:
              updateCourseDto.subtitle?.ar?.toLowerCase() ?? course.subtitle.ar,
          },
        },
        { new: true },
      );

      if (!updatedCourse) {
        const message =
          lang === 'ar' ? 'فشل في تحديث الدورة' : 'Failed to update the course';
        throw new NotFoundException(message);
      }

      return updatedCourse;
    } catch (error) {
      const message =
        lang === 'ar'
          ? 'حدث خطأ أثناء تحديث الدورة'
          : 'An error occurred while updating the course';
      throw new InternalServerErrorException(message);
    }
  }
  //============================================================================
  // Update course students list after purchase
  public async updateCourseJustFieldStudent(
    order: HydratedDocument<Order>,
    lang: 'en' | 'ar' = 'en',
  ) {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    const course = await this.getCourseDetailsByID(order.courseId, lang);
    const user = await this.userService.getCurrentUserDocument(
      order.userId,
      lang,
    );

    if (!course) {
      const message = lang === 'ar' ? 'الكورس غير موجود' : 'Course not found';
      throw new NotFoundException(message);
    }

    if (!user) {
      const message = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
      throw new NotFoundException(message);
    }

    course.students.push(user._id);

    await this.courseModel.findByIdAndUpdate(order.courseId, {
      students: course.students,
    });
  }
  //============================================================================
  // Delete a course by ID
  public async deleteCourse(
    courseId: Types.ObjectId,
    lang: 'en' | 'ar' = 'en',
  ) {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    try {
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        const message = lang === 'ar' ? 'الكورس غير موجود' : 'Course not found';
        throw new NotFoundException(message);
      }

      await course.deleteOne();

      const message =
        lang === 'ar' ? 'تم حذف الدورة بنجاح' : 'Course deleted successfully';
      return {
        success: true,
        message: message,
      };
    } catch (error) {
      const message =
        lang === 'ar' ? 'فشل في حذف الدورة' : 'Failed to delete course';
      throw new InternalServerErrorException(message);
    }
  }
  //============================================================================
  // Function to extract all unique categories with localization
  async getAllCategories() {
    const categories = await this.categoryModel.find().sort().lean();
    return categories.map((cat) => ({
      _id: cat._id,
      title: cat.title ?? '',
      description: cat.description ?? '',
      isFeatured: cat.isFeatured ?? false,
      displayOrder: cat.displayOrder ?? 0,
    }));
  }
  // Function to extract all unique levels with localization
  async getAllLevels() {
    const level = await this.levelModel.find().sort().lean();
    return level.map((cat) => ({
      _id: cat._id,
      title: cat.title ?? '',
    }));
  }
  // Get all courses with filters, sorting, pagination, and role-based access for teacher
  public async getCoursesByInstructor(
    instructorId: string,
    lang: 'en' | 'ar' = 'en',
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    totalCourses: number;
    totalPages: number;
    currentPage: number;
    courses: any[];
  }> {
    lang = ['en', 'ar'].includes(lang) ? lang : 'en';

    const filter = { instructorId: new Types.ObjectId(instructorId) };

    const skip = (page - 1) * limit;
    const totalCourses = await this.courseModel.countDocuments(filter);

    const courses = await this.courseModel
      .find(filter)
      .populate('category', 'title')
      .populate('level', 'title')
      .skip(skip)
      .limit(limit)
      .exec();

    const localizedCourses = courses.map((course) => ({
      ...course.toObject(),
      title: course.title?.[lang] || '',
      description: course.description?.[lang] || '',
      subtitle: course.subtitle?.[lang] || '',
      welcomeMessage: course.welcomeMessage?.[lang] || '',
      level: {
        en: (course.level as any)?.title?.en || '',
        ar: (course.level as any)?.title?.ar || '',
      },
      category: {
        en: (course.category as any)?.title?.en || '',
        ar: (course.category as any)?.title?.ar || '',
      },
    }));

    return {
      totalCourses,
      totalPages: Math.ceil(totalCourses / limit),
      currentPage: page,
      courses: localizedCourses,
    };
  }
  //============================================================================
  public async getCourseDistributionByCategory(
    lang: 'en' | 'ar' = 'en',
  ): Promise<{ category: string; count: number }[]> {
    // Dynamically select the language field for the category.
    const categoryField = `$category.${lang}`;

    const distribution = await this.courseModel.aggregate([
      {
        // Group documents by the localized category name.
        $group: {
          _id: categoryField,
          count: { $sum: 1 },
        },
      },
      {
        // Reshape the output documents.
        $project: {
          _id: 0,
          category: '$_id',
          count: '$count',
        },
      },
      {
        // Ensure we don't include a group for courses with no category.
        $match: {
          category: { $ne: null },
        },
      },
      {
        // Sort by the number of courses in descending order.
        $sort: { count: -1 },
      },
    ]);

    return distribution;
  }
  //============================================================================
  public async getCoursePublicationStats(): Promise<
    { status: 'Published' | 'Unpublished'; count: number }[]
  > {
    const stats = await this.courseModel.aggregate([
      {
        $group: {
          _id: '$isPublished',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = new Map(stats.map((item) => [item._id, item.count]));

    return [
      { status: 'Published', count: statsMap.get(true) || 0 },
      { status: 'Unpublished', count: statsMap.get(false) || 0 },
    ];
  }
}
