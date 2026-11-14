// FILE: server/src/config/mailer.js
import nodemailer from 'nodemailer';
import { env } from './env.js';

let transporter = null;

if (env.smtp.host && env.smtp.user && env.smtp.pass) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

/**
 * Mengirim email reset password atau menampilkan tautan di console saat mode development/mock
 */
export const sendMailOrLog = async ({ to, subject, html, text }) => {
  if (!transporter) {
    console.log('\n================ [MOCK EMAIL SENDER - UNAS PASIM] ================');
    console.log(`Kepada  : ${to}`);
    console.log(`Subjek  : ${subject}`);
    console.log(`Isi     : ${text}`);
    console.log('==================================================================\n');
    return { mocked: true };
  }

  return transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html,
  });
};
