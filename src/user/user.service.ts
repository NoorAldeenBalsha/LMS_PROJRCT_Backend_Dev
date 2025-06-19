import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model, Types } from 'mongoose';
import { AuthProvider } from './auth/auth.provider';
import { LoginDto } from './dto/login.dto';
import { JWTPayloadType } from 'utilitis/types';
import { UserRole } from 'utilitis/enums';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { StudentCourseService } from 'src/student-course/student-course.service';
import { Request, Response } from 'express';

@Injectable()
export class UserService {
  private roleTranslations = {
    ADMIN: { en: 'Admin', ar: 'مدير' },
    INSTRUCTOR: { en: 'Instructor', ar: 'مدرس' },
    STUDENT: { en: 'Student', ar: 'طالب' },
  };

  private genderTranslations = {
    male: { en: 'Male', ar: 'ذكر' },
    female: { en: 'Female', ar: 'أنثى' },
    other: { en: 'Other', ar: 'آخر' },
  };

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly authProvider: AuthProvider,
    private readonly studentService: StudentCourseService,
  ) {}

    public async Register(registerUserDto: RegisterUserDto, lang: 'en' | 'ar' = 'en') {
    lang=['en','ar'].includes(lang)?lang:'en'; 
    const { userName } = registerUserDto;
    if (!userName || typeof userName !== 'string') {
      const msg = lang === 'ar'
        ? 'اسم المستخدم مطلوب ويجب أن يكون نصًا'
        : 'Username is required and must be a string';
    throw new BadRequestException(msg);
  }

  // نعمل lowercase فقط
  registerUserDto.userName = userName.toLowerCase();

  return await this.authProvider.Register(registerUserDto,lang);
    }
    //============================================================================
    public async Login(loginDto: LoginDto,response:Response,lang: 'en' | 'ar' = 'en') {
      lang=['en','ar'].includes(lang)?lang:'en';
      return await this.authProvider.Login(loginDto,response,lang);
    }
    //============================================================================
    public async logout(response:Response) {
      await response.clearCookie('refresh_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/user/refresh-token',
      });

      return { message: 'Logged out successfully' };
    }
    //============================================================================
    public async refreshAccessToken(request:Request,response:Response){
      return await this.authProvider.refreshAccessToken(request,response);
    }
    //============================================================================
    //this one for course.servce (AddNewCourse)
    public async getCurrentUserDocument(id: Types.ObjectId,lang: 'en' | 'ar' = 'en') {
     lang=['en','ar'].includes(lang)?lang:'en';  
    const user = await this.userModel.findById(id);
    if (!user) {
    const msg = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
    throw new NotFoundException(msg);
    }
    return user;
    }
    // this one for all
    public async getCurrentUser(id: Types.ObjectId,lang: 'en' | 'ar' = 'en') {
      lang=['en','ar'].includes(lang)?lang:'en';
      const user = await this.userModel.findById(id)
      if (!user) {
        const msg = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
        throw new NotFoundException(msg);
  }

  return {
    userName: user.userName,
    role: this.roleTranslations[user.role]?.[lang] || user.role,
    gender: this.genderTranslations[user.gender]?.[lang] || user.gender,
    userEmail:user.userEmail,
    enrolledCourses:user.enrolledCourses,
    lastLogin:user.lastLogin,
    profileImage:user.profileImage,
    age:user.age
  };
    }
    //============================================================================
    public async getAllUsers(page: number = 1,limit: number = 10,search?: string,role?: string,lang: 'en' | 'ar' = 'en',) {
        lang=['en','ar'].includes(lang)?lang:'en';
        const query: any = {};
        if (search) {
          query.$or = [
            { [`userName.${lang}`]: { $regex: search, $options: 'i' } },
            { userEmail: { $regex: search, $options: 'i' } },
          ];
        }
        if (role) {
          query.role = role;
        }
        const totalUsers = await this.userModel.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);
        const users = await this.userModel
          .find(query)
          .select('userName userEmail role profileImage enrolledCourses gender age')
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();
        const usersWithLang = users.map((u) => ({...u,
          userName: u.userName,
          role: this.roleTranslations[u.role]?.[lang] || u.role,
          gender: this.genderTranslations[u.gender]?.[lang] || u.gender,}));
         return {success: true,totalUsers,currentPage: page,totalPages,data: usersWithLang,};
    }
    //============================================================================
    public async update(
    id: Types.ObjectId,
    currentUser: JWTPayloadType,
    updateUserDto: UpdateUserDto,
   lang: 'en' | 'ar' = 'en'
  ): Promise<User> {
    lang=['en','ar'].includes(lang)?lang:'en';

    // Only admins or the user themselves can update
    if (
      currentUser.userType !== UserRole.ADMIN &&
      id.toString() !== currentUser.id.toString()
    ) {
       const msg = lang === 'ar' ? 'غير مسموح لك بالتعديل' : 'You are not authorized to perform this action';
      throw new UnauthorizedException(msg);
    }

    const targetId =
      currentUser.userType === UserRole.ADMIN
        ? id
        : new Types.ObjectId(currentUser.id);

    const userFromDB = await this.userModel.findById(targetId);
   if (!userFromDB) {
      const msg = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
      throw new NotFoundException(msg);
    }

    const {
      userName,
      password,
      profileImage,
      age,
      gender,
      enrolledCourses,
    } = updateUserDto;

    if (userName) {
      if (typeof userName === 'string' ) {
        userFromDB.userName = userName;
      } else {
         const msg = lang === 'ar' ? 'يجب أن يكون userName كائن يحتوي على en و ar نصيين' :
                                    'userName must be an object with both en and ar strings';
        throw new BadRequestException(msg);
      }
    }

    if (profileImage) userFromDB.profileImage = profileImage;
    if (age !== undefined) userFromDB.age = age;
    if (gender) userFromDB.gender = gender;
    if (Array.isArray(enrolledCourses)) {
      userFromDB.enrolledCourses = [...enrolledCourses];
    }

    if (password) {
      userFromDB.password = await this.authProvider.hashPasswword(password);
    }

    return await userFromDB.save();
    }
    //============================================================================
    public async remove(
    id: Types.ObjectId,
    payload: JWTPayloadType,
    lang: 'en' | 'ar' = 'en'
  ): Promise<{ message: string }> {
      lang=['en','ar'].includes(lang)?lang:'en';
      if (!Types.ObjectId.isValid(id)) {
      const msg = lang === 'ar' ? 'معرف المستخدم غير صالح' : 'Invalid user ID';
      throw new BadRequestException(msg);
    }

    const userFromDB = await this.userModel.findById(id);
    if (!userFromDB) {
        const msg = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
      throw new NotFoundException(msg);
    }

    if (
      payload.userType === UserRole.ADMIN ||
      userFromDB._id.toString() === payload.id.toString()
    ) {
      // await this.userModel.deleteOne({ _id: id });
      await userFromDB.deleteOne();
       const msg = lang === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User has been deleted successfully';
      return { message: msg };
    }

    const msg = lang === 'ar' ? 'غير مسموح لك بحذف هذا المستخدم' : 'You are not allowed to delete this user';
    throw new ForbiddenException(msg);
    }
    //============================================================================
    public async verifyEmail(id: Types.ObjectId, verificationToken: string,lang: 'en' | 'ar' = 'en'): Promise<{ message: string }> {
      lang=['en','ar'].includes(lang)?lang:'en';
      const userFromDB = await this.userModel.findById(id);
      if (!userFromDB) {const msg = lang === 'ar' ? 'المستخدم غير موجود' : 'User not found';
      throw new NotFoundException(msg);}
      if (userFromDB.verificationToken === null) {
        const msg = lang === 'ar' ? 'لا توجد رمز تحقق موجود' : 'No verification token present';
      throw new NotFoundException(msg);
      }
      if (userFromDB.verificationToken !== verificationToken) {
        const msg = lang === 'ar' ? 'رمز التحقق غير صالح' : 'Invalid verification token';
      throw new NotFoundException(msg);
      }
  
      userFromDB.isAccountverified = true;
      userFromDB.verificationToken = null;
      await userFromDB.save();
  
      if (userFromDB.role === UserRole.STUDENT) {
        await this.studentService.getOrCreateStudent(userFromDB._id);
      }
  
      const msg = lang === 'ar' ? 'تم التحقق من البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.' : 'Email verified successfully. You can now log in.';
      return { message: msg };
    }
    //============================================================================
    public async sendRestPassword(email: string,lang: 'en' | 'ar' = 'en') {
            lang=['en','ar'].includes(lang)?lang:'en';
      return await this.authProvider.SendResetPasswordCode(email,lang);
    }
    //============================================================================

    //============================================================================
    public async resetPassword(body: ResetPasswordDto,lang: 'en' | 'ar' = 'en') {
            lang=['en','ar'].includes(lang)?lang:'en';
      return await this.authProvider.ResetPassword(body,lang);
    }
    //============================================================================
  }
