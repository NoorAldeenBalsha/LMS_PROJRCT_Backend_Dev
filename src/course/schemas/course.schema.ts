import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, {  HydratedDocument, Types } from "mongoose";
export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true })
export class Course {
  // Localized title in English and Arabic
  @Prop({ required: true, type: Object })
  title: { en: string; ar: string };

  // Localized description of the course
  @Prop({ required: true, type: Object })
  description: { en: string; ar: string };

  // Localized category name
  @Prop({type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;

  // Reference to the instructor (User collection)
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  instructorId: Types.ObjectId;

  // Instructor's display name
  @Prop({ required: true })
  instructorName: string;

  // Localized level information
  @Prop({type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true })
  level: {
    title: any; en: string; ar: string 
};

  // Primary language of the course (e.g., 'English', 'Arabic')
  @Prop({ required: true })
  primaryLanguage: string;

  // Localized subtitle
  @Prop({ required: true, type: Object })
  subtitle: { en: string; ar: string };

  // Course image URL
  @Prop({ required: true })
  image: string;

  // Localized welcome message for enrolled students
  @Prop({ type: Object })
  welcomeMessage: { en: string; ar: string };

  // Course price
  @Prop({ required: true })
  pricing: number;

  // Learning objectives of the course
  @Prop({ type: Object})
  objectives:{ en: string; ar: string };

  // List of students enrolled (reference to Student model)
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }], default: [] })
  students: Types.ObjectId[];

  // Curriculum of the course (list of lecture references)
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }], default: [] })
  curriculum: Types.ObjectId[];

  // Flag to determine if the course is published
  @Prop({ required: true })
  isPublished: boolean;
  
}
// تعريف الـ CourseSchema قبل تصديره
const CourseSchema = SchemaFactory.createForClass(Course);

// Hook for cascading deletes when a course is deleted
CourseSchema.pre<CourseDocument>('deleteOne', { document: true, query: false }, async function (next) {
  const courseId = this._id;

  const courseProgressModel = this.model('CourseProgress');
  const studentCourseModel = this.model('Student');
  const orderModel = this.model('Order');
  const lectureModel = this.model('Lecture');
  const lectureProgressModel = this.model('LectureProgres');

  // 🧼 حذف CourseProgress
  await courseProgressModel.deleteMany({ courseId });

  // 🧼 حذف الكورس من StudentCourse
  await studentCourseModel.updateMany(
    {},
    { $pull: { 'courses.$[].idCourses': courseId } }
  );

  // 🧼 حذف الطلبات المتعلقة بالكورس
  await orderModel.deleteMany({ courseId });

  // 🧼 جلب وحذف المحاضرات
  const lectureDocs = await lectureModel.find({ _id: { $in: this.curriculum || [] } });
  const lectureIds = lectureDocs.map(lec => lec._id.toString());

  await lectureModel.deleteMany({ _id: { $in: lectureIds } });

  // 🧼 حذف تقدم المحاضرات
  await lectureProgressModel.deleteMany({ lectureId: { $in: lectureIds } });

  next();
});

export { CourseSchema };