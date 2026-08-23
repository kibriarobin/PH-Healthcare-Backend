import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import config from "../../config";

const applyDoctor = async (
  payload: any,
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

  return doctorApplication;
};

export const DoctorService = {
  applyDoctor,
};
