import z from "zod";

const PatientZodRegisterSchema = z.object({
  name: z
    .string("Name is required")
    .min(3, "Name must be at least 3 characters long"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

const PatientZodLoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

const ForgotPasswordZodSchema = z.object({
  email: z.email("Invalid email address"),
});

const ResetPasswordZodSchema = z.object({
  email: z.email("Invalid email address"),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
  otp: z.string().length(6),
});

export const userValidation = {
  PatientZodRegisterSchema,
  PatientZodLoginSchema,
  ForgotPasswordZodSchema,
  ResetPasswordZodSchema,
};
