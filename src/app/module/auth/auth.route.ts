import { Router } from "express";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { userValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(userValidation.PatientZodRegisterSchema),
  AuthController.registerPatient,
);
router.post(
  "/login",
  validateRequest(userValidation.PatientZodLoginSchema),
  AuthController.loginUser,
);

router.get(
  "/me",
  auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin);

export const AuthRoutes = router;
