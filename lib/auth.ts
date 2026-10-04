export const ALLOWED_EMAIL_DOMAIN = "themarketingtrainer.co.uk";

export const isAllowedEmail = (email: string) =>
  email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
