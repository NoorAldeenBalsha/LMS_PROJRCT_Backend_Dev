import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  Query,
  Req,
  Headers,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Roles } from 'src/user/decorator/user-role.decorator';
import { AuthRolesGuard } from 'src/user/guard/auth-role.guard';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { JWTPayloadType } from 'utilitis/types';
import { Types } from 'mongoose';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/user/guard/auth.guard';

@ApiTags('Courses')
@Controller('api/course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  // ADD NEW COURSE[Admin & Teacher]
  @Post('add-course')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Add a new course' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  @ApiResponse({ status: 403, description: 'Only admins or teachers can add courses',})
  @ApiBody({ description: 'Course creation data', type: CreateCourseDto })
  public AddNewCourse(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createCourseDto: CreateCourseDto,
    @CurrentUser() user: JWTPayloadType,
    @Req() req: any,
  ) {
    const lang = req.lang || 'en';
    return this.courseService.AddNewCourse(createCourseDto, user.id, lang);
  }
  // UPDATE COURSE BY ID[Admin & Teacher]
  @Patch('update/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Update a course' })
  @ApiParam({ name: 'id', description: 'Course ID' })
  @ApiBody({ type: UpdateCourseDto })
  public updateCourseByID(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateCourseDto: UpdateCourseDto,
    @CurrentUser() user: JWTPayloadType,
    @Req() req: any,
  ) {
    const lang = req.lang || 'en';

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        message: lang === 'ar' ? 'يوجد أخطاء' : 'There are errors',
        errors:
          lang === 'ar' ? 'معرف الدورة غير صالح' : 'Invalid course ID format',
      });
    }

    return this.courseService.updateCourseByID(
      new Types.ObjectId(id),
      updateCourseDto,
      user.id,
      lang,
    );
  }
  // get course for teacher [Teacher]
  @Get('my-courses')
  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('teacher')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get courses of the current instructor' })
  @ApiResponse({ status: 200, description: 'Instructor courses retrieved successfully', })
  public getInstructorCourses(
    @CurrentUser() user: JWTPayloadType,
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const lang = req.lang || 'en';
    return this.courseService.getCoursesByInstructor(
      user.id.toString(),
      lang,
      page,
      limit,
    );
  }
  // GET ALL COURSES [PUBLIC]
  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all courses with filters (role-based)' })
  @ApiResponse({ status: 200, description: 'Courses fetched successfully' })
  public async getAllCourses(
    @Req() req: any,
    @Query('category') category?: string | string[],
    @Query('level') level?: string | string[],
    @Query('primaryLanguage') primaryLanguage?: string,
    @Query('sortBy') sortBy: string = 'price-lowtohigh',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('useFilter') useFilter: boolean = false,
    @Headers('lang') lang: 'en' | 'ar' = 'en',
  ) {
    return this.courseService.getAllCourses(
      category,
      level,
      primaryLanguage,
      sortBy,
      page,
      limit,
      useFilter,
      lang,
      req.user, // ⬅️ مهم جداً تمرير اليوزر من التوكن
    );
  }
  //Get All Courses [PUBLIC]
  @Get('all-filter')
  @ApiOperation({ summary: 'Retrieve all courses without role restrictions' })
  @ApiResponse({ status: 200, description: 'Courses fetched successfully' })
  public getAllCoursesFilter(
    @Query('sortBy') sortBy?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Headers('lang') lang: 'en' | 'ar' = 'en',
    @Query('category') categoryIds?:string,
    @Query('level') levelIds ?:string,
  ) {
    
    return this.courseService.getAllCoursesNoFilter(sortBy, +page, +limit, lang,categoryIds,levelIds);
  }
  // GET COURSE BY ID [PUBLIC]
  @Get('getCourseById/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get course details by ID with optional filters' })
  @ApiParam({ name: 'id', description: 'Course ID' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sorting method (e.g., price-lowtohigh)' })
  @ApiQuery({ name: 'category', required: false, type: [String], description: 'One or more Category IDs' })
  @ApiQuery({ name: 'level', required: false, description: 'Level ID' })
  @ApiResponse({ status: 200, description: 'Course details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  public getCourseDetailsByID(
    @Param('id') id: string,
    @Query('sortBy') sortBy: string,
    @Query('category') category: string[] | string,
    @Query('level') level: string[]| string,
    @Req() req: any,
  ) {
    const lang: 'en' | 'ar' = ['en', 'ar'].includes(req.lang) ? req.lang : 'en';

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        message: lang === 'ar' ? 'يوجد أخطاء' : 'There are errors',
        errors: lang === 'ar' ? 'معرف الدورة غير صالح' : 'Invalid course ID format',
      });
    }

    const categoryArray = Array.isArray(category)
      ? category
      : category
      ? [category]
      : [];
      const levelyArray = Array.isArray(level)
      ? level
      : level
      ? [level]
      : [];

    return this.courseService.getCourseDetailsByID(
      new Types.ObjectId(id),
      lang,
      req.user,
      
      categoryArray,
      levelyArray,
      sortBy
    );
  }
  // DELETE COURSE[Admin & Teacher]
  @Delete('delete/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Delete a course by ID' })
  @ApiParam({ name: 'id', description: 'Course ID to delete' })
  @ApiResponse({ status: 200, description: 'Course deleted successfully' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async deleteCourse(@Param('id') id: string, @Req() req: any) {
    const lang = req.lang || 'en';

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        message: lang === 'ar' ? 'يوجد أخطاء' : 'There are errors',
        errors:
          lang === 'ar' ? 'معرف الدورة غير صالح' : 'Invalid course ID format',
      });
    }

    return this.courseService.deleteCourse(new Types.ObjectId(id), lang);
  }
  //Get categories [PUBLIC]
  @Get('categories')
  @ApiOperation({ summary: 'Get all available course categories' })
  async getCategories() {
    return this.courseService.getAllCategories();
  }
  //Get levels [PUBLIC]
  @Get('levels')
  @ApiOperation({ summary: 'Get all available course categories' })
  async getlevel() {
    return this.courseService.getAllLevels();
  }

  @Get('stats/category-distribution')
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get course distribution by category (Admin only)' })
  @ApiResponse({ status: 200, description: 'Course distribution data retrieved successfully.',})
  @ApiResponse({status: 403,description: 'Forbidden. Only admins can access this resource.',})
  public getCourseDistribution(@Req() req: any) {
    const lang = req.lang || 'en';
    return this.courseService.getCourseDistributionByCategory(lang);
  }

  @Get('stats/publication-status')
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({summary: 'Get statistics on published vs. unpublished courses (Admin only)',})
  @ApiResponse({ status: 200, description: 'Publication status data retrieved successfully.',})
  @ApiResponse({ status: 403, description: 'Forbidden. Only admins can access this resource.',})
  public getCoursePublicationStats() {
    return this.courseService.getCoursePublicationStats();
  }
}
