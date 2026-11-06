import { z } from 'zod';

const name = z.string().trim().min(1, 'Enter a name.').max(120);
const roleKey = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);

export const inviteStaffSchema = z
  .object({
    name,
    email: z.string().trim().max(254).pipe(z.email('Enter a valid email address.')),
    roles: z.array(roleKey).min(1, 'Choose at least one role.').max(10),
  })
  .strict();

export const updateStaffSchema = z.object({ name }).strict();
export const setRolesSchema = z.object({ roles: z.array(roleKey).max(10) }).strict();

export const roleSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Use lowercase letters, numbers and underscores, starting with a letter.'),
    name: z.string().trim().min(2, 'Enter a role name.').max(60),
    description: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => (v ? v : undefined)),
    permissions: z.array(z.string().max(60)).max(100),
  })
  .strict();
export const updateRoleSchema = roleSchema.omit({ key: true });

export const staffListQuery = z
  .object({
    q: z.string().max(80).optional(),
    status: z.enum(['invited', 'active', 'disabled']).optional(),
    role: roleKey.optional(),
  })
  .strict();
