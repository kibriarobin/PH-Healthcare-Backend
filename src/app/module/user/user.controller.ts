import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const uploadProfilePhoto = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new Error("File not found");
  }

  const userId = req.user?.userId;

  const result = await UserService.uploadProfilePhoto(req.file.buffer, userId!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Updated profile picture",
    data: result,
  });
});

export const UserController = {
  uploadProfilePhoto,
};
