import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { DoctorValidation } from "./doctor.validation";

const router = Router();

router.post(
  "/apply-doctor",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 5 },
  ]),
  DoctorController.applyDoctor,
);

router.post("/apply-doctor/verify-email", DoctorController.verifyDoctorEmail);

router.post(
  "approve-doctor",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  DoctorController.approveDoctor,
);

router.get(
  "all-doctors",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  DoctorController.getAllDoctors,
);

router.patch(
  "/update-my-profile",
  auth(Role.DOCTOR),
  validateRequest(DoctorValidation.UpdateDoctorProfileValidationZodSchema),
  DoctorController.updateDoctorProfile,
);

router.get(
  "/public/available-today",
  DoctorController.getAvailableDoctorByTodaysSchedule,
);

router.get("/public/all-doctors", DoctorController.getAllDoctorsListPublic);


export const DoctorRoutes = router;
