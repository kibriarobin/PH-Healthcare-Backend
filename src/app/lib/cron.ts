import nodeCron from "node-cron";
import { prisma } from "./prisma";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";

export const deleteUnverifiedDoctors = async () => {
  nodeCron.schedule("*/10 * * * *", async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const deleteDoctors = await prisma.user.deleteMany({
        where: {
          role: Role.DOCTOR,
          emailVerified: false,
          createdAt: { lt: oneHourAgo },
          doctor: { verificationStatus: DoctorVerificationStatus.PENDING },
        },
      });

      if (deleteDoctors.count > 0) {
        console.log(
          `Cleaned up ${deleteDoctors.count} unverified doctor account(s)`,
        );
      }
    } catch (error) {
      console.log(
        "Cron: Failed to delete unverified doctor applications",
        error,
      );
    }

    console.log("Unverified Doctor Delete cron schedule (every 10 minutes)");
    
  });
};
