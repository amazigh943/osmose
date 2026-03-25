import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_PASSWORD,
  },
})

export async function sendMail({ to, subject, html, attachments }: {
  to: string
  subject: string
  html: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments?: any[]
}) {
  return transporter.sendMail({
    from: 'Osmose <no-reply@osmose-seven.vercel.app>',
    to,
    subject,
    html,
    attachments,
  })
}
