import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorService } from "./doctor.service";
import { DoctorValidation } from "./doctor.validation";

const applyDoctor = catchAsync(async (req: Request, res: Response) => {
  const validateData = DoctorValidation.applyDoctorZodSchema.safeParse(
    JSON.parse(req.body.data),
  );

  if (!validateData.success) {
    throw new Error(validateData.error.issues[0].message);
  }

  const payload = validateData.data;

  const files = req.files as {
    resume?: Express.Multer.File[];
    additionalFiles?: Express.Multer.File[];
  };

  const resume = files?.resume?.[0];

  if (!resume) {
    throw new Error("Resume file is required");
  }

  const additionalFiles = files?.additionalFiles || [];

  const result = await DoctorService.applyDoctor(
    payload,
    resume,
    additionalFiles,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Application submitted successfully",
    data: result,
  });
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await DoctorService.verifyDoctorEmail(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor email verified successfully",
    data: result,
  });
});

const approveDoctor = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await DoctorService.approveDoctor(payload, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor application approved successfully",
    data: result,
  });
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await DoctorService.getAllDoctors(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Retrieved all doctors successfully",
    data: data,
    meta: meta,
  });
});

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await DoctorService.updateDoctorProfile(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Profile Updated Successfully",
    data: result,
  });
});

export const DoctorController = {
  applyDoctor,
  verifyDoctorEmail,
  approveDoctor,
  getAllDoctors,
  updateDoctorProfile,
};
