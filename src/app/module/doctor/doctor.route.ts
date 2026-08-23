import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.post(
  "/apply-doctor",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 5 },
  ]),
  DoctorController.applyDoctor,
);

export const DoctorRoutes = router;
