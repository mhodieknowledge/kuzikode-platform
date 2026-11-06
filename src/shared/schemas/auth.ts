import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email('Enter a valid email address.'))
  .transform((e) => e.toLowerCase());

/** Length only here; the full policy (common passwords etc.) runs on the server. */
export const newPasswordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.');

export const audienceSchema = z.enum(['admin', 'portal']);
export type Audience = z.infer<typeof audienceSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password.').max(128),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({ email: emailSchema, turnstileToken: z.string().max(2048).optional() })
  .strict();

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: newPasswordSchema })
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: newPasswordSchema })
  .strict();

export const acceptInviteSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: newPasswordSchema,
    name: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) }).strict();

/** Optional portal self-registration (PRD §5, off by default). The account sees nothing until staff link it. */
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(120),
    company: z.string().trim().max(160).optional(),
    email: emailSchema,
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === '' || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number.');

/** Own profile: name and phone. The email is the sign-in identity and is changed by staff only. */
export const profileSchema = z
  .object({ name: z.string().trim().min(1, 'Enter your name.').max(120), phone: phoneSchema })
  .strict();
export type ProfileInput = z.infer<typeof profileSchema>;
