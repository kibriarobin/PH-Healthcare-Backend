import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import config from "../config";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: Role.SUPER_ADMIN,
      },
    });

    if (isSuperAdminExists) {
      console.log("Super admin already exist");
      return;
    }

    const name = config.super_admin_name;
    const email = config.super_admin_email;
    const password = config.super_admin_password;

    if (!name || !email || !password) {
      throw new Error(
        "Super admin credentials are not provided in the .env file",
      );
    }

    const hashPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const superAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashPassword,
        role: Role.SUPER_ADMIN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log("Super admin created successfully", superAdmin);
  } catch (error) {
    console.error("Error creating super admin:", error);

    await prisma.user.delete({
      where: {
        email: config.super_admin_email,
      },
    });
  }
};

export const seedTesterAdmin = async () => {
  try {
    const isTesterAdminExists = await prisma.user.findUnique({
      where: {
        email: config.tester_admin_email,
      },
    });

    if (isTesterAdminExists) {
      console.log("Tester admin already exist");
      return;
    }

    const name = config.tester_admin_name;
    const email = config.tester_admin_email;
    const password = config.tester_admin_password;

    if (!name || !email || !password) {
      throw new Error(
        "Tester admin credentials are not provided in the .env file",
      );
    }

    const hashPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashPassword,
        role: Role.ADMIN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log("Tester admin created successfully", testerAdmin);
  } catch (error) {
    console.error("Error creating tester admin:", error);

    await prisma.user.delete({
      where: {
        email: config.tester_admin_email,
      },
    });
  }
};

export const seedTesterDoctor = async () => {
  try {
    const isTesterDoctorExists = await prisma.user.findUnique({
      where: {
        email: config.tester_doctor_email,
      },
    });

    if (isTesterDoctorExists) {
      console.log("Tester doctor already exist");
      return;
    }

    const name = config.tester_doctor_name;
    const email = config.tester_doctor_email;
    const password= config.tester_doctor_password

    if (!name || !email || !password) {
      throw new Error(
        "Tester doctor credentials are not provided in the .env file",
      );
    }

    const hashPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerDoctor = await prisma.user.create({
        data:{
            name,
            email,
            password: hashPassword,
            role: Role.DOCTOR,
            needPasswordChange: false,
            emailVerified: true
        }
    })

    console.log("Tester doctor created successfully", testerDoctor)


  } catch (error) {
    console.error("Error creating tester doctor:", error);
  }
};
