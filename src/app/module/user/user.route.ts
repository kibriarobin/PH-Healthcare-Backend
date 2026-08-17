import { Router } from "express";
import { UserController } from "./user.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.patch(
  "/profile-photo",
  auth(Role.SUPER_ADMIN, Role.ADMIN, Role.DOCTOR, Role.PATIENT),
  upload.single("profilePhoto"),
  UserController.uploadProfilePhoto,
);

export const UserRoutes = router;
