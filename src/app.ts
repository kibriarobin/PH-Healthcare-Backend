import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Application,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { UserRoutes } from "./app/module/user/user.route";
import { getBKashIdToken } from "./app/lib/bkash";
import { AppointmentRoutes } from "./app/module/appointment/appointment.route";
import { DoctorRoutes } from "./app/module/doctor/doctor.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", AuthRoutes);

app.use("/api/user", UserRoutes);

app.use("/api/appointment", AppointmentRoutes)

app.use("/api/doctor", DoctorRoutes)

app.use("/api/schedule", ScheduleRoutes)

app.use("/api/payment", PaymentRoutes)


app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grantIdTokenResult = await getBKashIdToken();

    console.log(grantIdTokenResult);

    res.status(httpStatus.OK).json({
      success: true,
      message: "bkash success",
      data: null,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// Basic route
app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to PH Healthcare System Backend",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
