import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, InternalServerErrorException, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;
  constructor(private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {
      this.transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true لأنك تستخدم بورت 465
  auth: {
    user: 'mhabnoor75@gmail.com',
    pass: 'grylxexibuiscxwa',
  },
});
  }

  async sendVerifyEmailTemplate(toEmail: string, verificationLink: string, lang: 'ar' | 'en' = 'en') {
    const subject = lang === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Email Verification';
    const text = lang === 'ar'
      ?` مرحباً، الرجاء الضغط على الرابط التالي لتأكيد بريدك الإلكتروني: ${verificationLink}`
      : `Hello, please click the following link to verify your email: ${verificationLink}`;

    const html = lang === 'ar'
      ? `<p>مرحباً،</p><p>الرجاء الضغط على الرابط التالي لتأكيد بريدك الإلكتروني:</p><a href="${verificationLink}">${verificationLink}</a>`
      : `<p>Hello,</p><p>Please click the following link to verify your email:</p><a href="${verificationLink}">${verificationLink}</a>`;

    await this.sendEmail(toEmail, subject, text, html, lang);
  }

  async sendRestPasswordTemplate(toEmail: string, resetLink: string, lang: 'ar' | 'en' = 'en') {
    const subject = lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password Reset';
    const text = lang === 'ar'
      ?` مرحبا، يمكنك إعادة تعيين كلمة المرور الخاصة بك عبر الرابط التالي: ${resetLink}`
      : `Hello, you can reset your password using the following link: ${resetLink}`;

    const html = lang === 'ar'
      ? `<p>مرحبا،</p><p>يمكنك إعادة تعيين كلمة المرور الخاصة بك عبر الرابط التالي:</p><a href="${resetLink}">${resetLink}</a>`
      : `<p>Hello,</p><p>You can reset your password using the following link:</p><a href="${resetLink}">${resetLink}</a>`;

    await this.sendEmail(toEmail, subject, text, html, lang);
  }
  
public async sendLoginEmail(email: string, lang: 'en' | 'ar' = 'en'): Promise<void> {
  try {
    const today = new Date();
    await this.mailerService.sendMail({
      to: email,
      from: `"No Reply" <${this.configService.get('MAIL_USER')}>`,
      subject: lang === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Login to your account',
      template: 'login', 
      context: {
        email,
        today,
        lang,
      },
    });
  } catch (err) {
    console.error(' Failed to send login email:', err);
    throw new RequestTimeoutException('Something went wrong, please try again later');
  }
}

  private async sendEmail(toEmail: string, subject: string, text: string, html: string, lang: 'ar' | 'en') {
     try {
      const fromEmail = this.configService.get('MAIL_USER');
      await this.mailerService.sendMail({
        from: `"No Reply" <${fromEmail}>`,
        to: toEmail,
        subject,
        text,
        html,
      });
    } catch (error) {
      console.error(' Error sending email:', error);
      throw new InternalServerErrorException(lang === 'ar' ? 'فشل في إرسال البريد الإلكتروني' : 'Failed to send email');
    }
  }
}