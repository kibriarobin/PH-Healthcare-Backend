import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { catchAsync } from "../../utils/catchAsync";
import type { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await AnalyticsService.getAdminAnalytics();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin Analytics Retrieved Successfully",
    data: result,
  });
});

const getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const result = await AnalyticsService.getPatientAnalytics(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Patient Analytics Retrieved Successfully",
    data: result,
  });
});

const getDoctorAnalytics = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const result = await AnalyticsService.getDoctorAnalytics(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Analytics Retrieved Successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getAdminAnalytics,
  getPatientAnalytics,
  getDoctorAnalytics,
};
