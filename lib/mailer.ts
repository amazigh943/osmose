import Mailjet from 'node-mailjet'

export async function sendMail({ to, subject, html, attachments }: {
  to: string
  subject: string
  html: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments?: any[]
}) {
  const mailjet = new Mailjet({
    apiKey: process.env.MAILJET_API_KEY ?? '',
    apiSecret: process.env.MAILJET_SECRET_KEY ?? '',
  })

  const result = await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: 'hadjazi9429@gmail.com', Name: 'Osmose' },
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
        Attachments: attachments?.map(a => ({
          ContentType: a.contentType ?? 'application/octet-stream',
          Filename: a.filename,
          Base64Content: Buffer.isBuffer(a.content)
            ? a.content.toString('base64')
            : a.content,
        })) ?? [],
      },
    ],
  })
  console.log('[mailer] Mail envoyé:', result.body)
  return result
}
