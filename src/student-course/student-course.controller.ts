import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { StudentCourseService } from './student-course.service';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { JWTPayloadType } from 'utilitis/types';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/user/decorator/user-role.decorator';
import { AuthRolesGuard } from 'src/user/guard/auth-role.guard';
import { AuthGuard } from 'src/user/guard/auth.guard';

@ApiTags('Student Course')
@Controller('api/student-course')
export class StudentCourseController {
  constructor(private readonly studentCourseService: StudentCourseService) {}

  // ─────────────────────────────────────────────────────────────
  // Public endpoints (no authentication required)
  // ─────────────────────────────────────────────────────────────

  @Get('All-student-view-course')
  @ApiOperation({summary: 'List courses available to students',description:'Retrieve all courses that any student could potentially view (with optional filters).',})
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'level', required: false, description: 'Filter by course level' })
  @ApiQuery({ name: 'primaryLanguage', required: false, description: 'Filter by language' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort order (e.g. price-lowtohigh)' })
  @ApiResponse({ status: 200, description: 'Courses retrieved successfully.' })
  public getAllStudentViewCourses(
    @Query('category') category?: string,
    @Query('level') level?: string,
    @Query('primaryLanguage') primaryLanguage?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page: number=1,
    @Query('limit') limit: number=10,
  ) {
    return this.studentCourseService.getAllStudentViewCourses(category,level,primaryLanguage,sortBy,page,limit,);
  }

  @Get('All-student-view-course-details/:courseId')
  @ApiOperation({summary: 'Get public course details',description: 'Fetch detailed information about a specific course for viewing.',})
  @ApiParam({ name: 'courseId', type: String, description: 'Course ObjectId' })
  @ApiResponse({ status: 200, description: 'Course details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Course not found.' })
  public getStudentViewCourseDetails(@Param('courseId') courseId: string) {
    return this.studentCourseService.getStudentViewCourseDetails(
      new Types.ObjectId(courseId),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Student-only endpoints
  // ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('student')
  @Get('check-purchase/:courseId')
  @ApiOperation({summary: 'Check purchase status for a course',description: 'Determine whether the current student has purchased the given course.',})
  @ApiParam({ name: 'courseId', type: String, description: 'Course ObjectId' })
  @ApiResponse({ status: 200, description: 'Purchase status returned.' })
  @ApiResponse({ status: 404, description: 'Student or purchase record not found.' })
  public checkCoursePurchaseInfo(@Param('courseId') courseId: string,@CurrentUser() user: JWTPayloadType,@Req()req:any) {
    const lang = req.lang||'en';
    return this.studentCourseService.checkCoursePurchaseInfo(new Types.ObjectId(courseId),user,lang);
  }
 
  // ─────────────────────────────────────────────────────────────
  // Admin and Teacher endpoints
  // ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AuthRolesGuard)
  @Roles('admin', 'teacher')
  @Get('get-all-courses-for-you/:studentId')
  @ApiOperation({summary: 'Get all purchased courses for a student',description:'Retrieve the list of courses that a specific student has purchased.',})
  @ApiParam({ name: 'studentId', type: String, description: 'Student’s UserId ObjectId' })
  @ApiResponse({ status: 200, description: 'Purchased courses retrieved.' })
  @ApiResponse({ status: 404, description: 'Student not found or no purchases.' })
  public getAllCoursesForCurrentStudent(@Param('studentId') studentId: string,@CurrentUser() user: JWTPayloadType,@Req()req:any) {
    const lang = req.lang||'en';
    return this.studentCourseService.getAllCoursesForCurrentStudent(new Types.ObjectId(studentId),user,lang);
  }

@UseGuards(AuthGuard, AuthRolesGuard)
@Roles('admin', 'teacher')
@Post('enroll-student')
@ApiOperation({ summary: 'Enroll student in course (admin/teacher only)' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      userId: { type: 'string', example: '685280430029d74473dff9ca' },
      courseId: { type: 'string', example: '6852953e0029d74473dffa29' },
    },
    required: ['userId', 'courseId'],
  },
})
public enrollStudentInCourse(
  @Body('userId') userId: string,
  @Body('courseId') courseId: string,
) {
  return this.studentCourseService.enrollStudentInCourse(
    new Types.ObjectId(userId),
    new Types.ObjectId(courseId),
  );
}
}
