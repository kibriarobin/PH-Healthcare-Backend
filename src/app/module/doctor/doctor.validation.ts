import { z } from "zod";

const applyDoctorZodSchema = z.object({
  user: z.object({
    name: z
      .string({ error: "Name is required" })
      .min(2, "Name must be at least 2 characters long"),
    email: z.email("Invalid email address"),
  }),
  doctor: z.object({
    address: z.string().optional(),
    bio: z.string().optional(),
    contactNumber: z
      .string()
      .regex(/^01[3-9]\d{8}$/, "Invalid Bangladeshi phone number")
      .optional(),
    specialization: z
      .string({ error: "Specialization is required" })
      .min(2, "Specialization must be at least 2 characters long"),
    licenseNumber: z
      .string({ error: "License number is required" })
      .min(3, "License number must be at least 3 characters long"),
    qualifications: z
      .string({ error: "Qualifications are required" })
      .min(2, "Qualifications must be at least 2 characters long"),
    experienceYears: z
      .number({ error: "Experience years is required" })
      .int("Experience years must be a whole number")
      .min(0, "Experience years cannot be negative")
      .max(70, "Experience years seems invalid"),
    consultationFee: z
      .number()
      .positive("Consultation fee must be a positive number")
      .optional(),
  }),
});

const UpdateDoctorProfileValidationZodSchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters long")
    .optional(),

  bio: z
    .string()
    .trim()
    .max(1000, "Bio cannot exceed 1000 characters")
    .optional(),

  consultationFee: z
    .number()
    .min(0, "Consultation fee cannot be negative")
    .optional(),

  contactNumber: z
    .string()
    .trim()
    .min(5, "Contact number is invalid")
    .optional(),
});

export const DoctorValidation = {
  applyDoctorZodSchema,
  UpdateDoctorProfileValidationZodSchema,
};
