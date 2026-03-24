import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }
  console.log(to, subject, html)
  return resend.emails.send({
    from: "onboarding@resend.dev", // change later to your domain
    to,
    subject,
    html,
  });
}