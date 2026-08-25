import { DoctorVerificationStatus } from "./../../../generated/prisma/enums";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import config from "../../config";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";
import type {
  IApplyAsDoctorPayload,
  IApproveDoctorPayload,
  IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import { Role } from "../../../generated/prisma/enums";
import type { RequestUser } from "../../middleware/checkAuth";

const applyDoctor = async (
  payload: IApplyAsDoctorPayload,
  resume: Express.Multer.File,
  additionalFiles: Express.Multer.File[],
) => {
  const idExistUser = await prisma.user.findUnique({
    where: {
      email: payload.user.email,
    },
  });

  if (idExistUser) {
    throw new Error("User already exist this email");
  }

  const resumeUploadResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, async (error, result) => {
          if (error) {
            return reject(error);
          }

          if (!result) {
            return reject("No result return from cloudinary");
          }
          resolve(result);
        })
        .end(resume.buffer);
    },
  );

  const additionalFileUploadResult = await Promise.all(
    additionalFiles.map((file) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "auto" }, async (error, result) => {
            if (error) {
              return reject(error);
            }

            if (!result) {
              return reject("No result return from cloudinary");
            }
            resolve(result);
          })
          .end(file.buffer);
      });
    }),
  );

  const randomPassword = Math.random().toString(36).slice(-8);

  const hashPassword = await bcrypt.hash(
    randomPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const doctorApplication = await prisma.user.create({
    data: {
      ...payload.user,
      password: hashPassword,
      role: "DOCTOR",
      needPasswordChange: true,
      doctor: {
        create: {
          name: payload.user.name,
          email: payload.user.email,
          ...payload.doctor,
          resume: resumeUploadResult.secure_url,
          resumePublicId: resumeUploadResult.public_id,
          additionalFiles: additionalFileUploadResult.map((file) => ({
            url: file.secure_url,
            publicId: file.public_id,
          })),
        },
      },
    },
  });

  const expirationSeconds = 60 * 60;

  const otpKey = `doctor-application:otp:${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/doctor-verification.ejs",
  );

  const templateData = {
    name: payload.user.name,
    email: payload.user.email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: payload.user.email,
    subject: "Verify Your Email - PH Healthcare Doctor Application",
    html,
  });

  return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
  const otp = payload.otp;
  const email = payload.email;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
      role: Role.DOCTOR,
    },
  });

  if (!existingUser) {
    throw new Error("Doctor application not found");
  }

  if (existingUser.emailVerified) {
    throw new Error("Email is already verified");
  }

  const otpKey = `doctor-application-otp:${email}`;

  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new Error(
      "OTP is expired. Your application window is closed, please apply again",
    );
  }

  if (redisOtp !== otp) {
    throw new Error("OTP does not match");
  }

  await redisClient.del(otpKey);

  const verifiedDoctor = await prisma.user.update({
    where: { id: existingUser.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { doctor: true },
  });

  return verifiedDoctor;
};

const approveDoctor = async (
  payload: IApproveDoctorPayload,
  reviewer: RequestUser,
) => {
  const { doctorId, verificationStatus, rejectionReason } = payload;

  const existingDoctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!existingDoctor) {
    throw new Error("Doctor application not found");
  }

  if (existingDoctor.isDeleted) {
    throw new Error("Doctor application has been deleted");
  }

  if (!existingDoctor.user?.emailVerified) {
    throw new Error(
      "Doctor has not verified their email yet. application can not be reviewed",
    );
  }

  if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
    throw new Error(
      `Doctor application has already been ${existingDoctor.verificationStatus.toLowerCase()}`,
    );
  }

  if (
    verificationStatus === DoctorVerificationStatus.REJECTED &&
    !rejectionReason
  ) {
    throw new Error(
      "Rejection reason is required when rejecting a doctor application",
    );
  }

  const updateDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === DoctorVerificationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
  });

  const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;

  const templatePath = path.join(
    process.cwd(),
    `src/app/templates/${
      isApproved
        ? "doctor-application-approve.ejs"
        : "doctor-application-rejection.ejs"
    }`,
  );

  const templateData = {
    doctorName: updateDoctor.name,
    doctorEmail: updateDoctor.email,
    specialization: updateDoctor.specialization,
    rejectionReason: isApproved ? undefined : rejectionReason,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: updateDoctor.email,
    subject: isApproved
      ? "Your doctor application has been approved"
      : "Your doctor application has been rejected",
    html,
  });

  return updateDoctor;
};

export const DoctorService = {
  applyDoctor,
  verifyDoctorEmail,
  approveDoctor,
};
