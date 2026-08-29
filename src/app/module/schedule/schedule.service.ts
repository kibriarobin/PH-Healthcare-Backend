import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import type {
  ICreateSchedulePayload,
  IUpdateSchedulePayload,
} from "./schedule.interface";
import { IQuery } from "../../interface";
import { ScheduleWhereInput } from "../../../generated/prisma/models";
import { ScheduleStatus } from "../../../generated/prisma/enums";

const createSchedule = async (
  payload: ICreateSchedulePayload,
  user: RequestUser,
) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new Error("Doctor profile not found");
  }

  const startOfTheDay = startOfDay(payload.startDateTime);
  const startOnNextDay = addDays(startOfTheDay, 1);

  const existingScheduleOnThisDate = await prisma.schedule.findFirst({
    where: {
      doctorId: doctor.id,
      isDeleted: false,
      startDateTime: {
        gte: startOfTheDay,
        lt: startOnNextDay,
      },
    },
  });

  if (existingScheduleOnThisDate) {
    throw new Error("You already have a schedule on this date");
  }

  const durationInMinutes = differenceInMinutes(
    payload.startDateTime,
    payload.endDateTime,
  );

  const minutesAllocatedPerSlots = 20;

  const totalSlots = Math.floor(durationInMinutes / minutesAllocatedPerSlots);

  const schedule = await prisma.schedule.create({
    data: {
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      meetingLink: payload.meetingLink,
      totalSlots,
      availableSlots: totalSlots,
      doctorId: doctor.id,
    },
    include: {
      doctor: {
        select: {
          name: true,
          email: true,
          contactNumber: true,
        },
      },
    },
  });

  return schedule;
};

const getMySchedule = async (query: IQuery, user: RequestUser) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const andConditions: ScheduleWhereInput[] = [
    {
      doctorId: doctor.id,
    },
    {
      isDeleted: false,
    },
  ];

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const schedule = await prisma.schedule.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip: skip,
    orderBy: { [sortBy]: sortOrder },
    include: {
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  const totalSchedule = await prisma.schedule.count({
    where: { AND: andConditions },
  });

  return {
    data: schedule,
    meta: {
      page: page,
      limit: limit,
      total: totalSchedule,
      totalPages: Math.ceil(totalSchedule / limit),
    },
  };
};

const getAllSchedule = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ScheduleWhereInput[] = [];

  if (query.doctorId) {
    andConditions.push({ doctorId: query.doctorId });
  }

  if (query.email) {
    andConditions.push({ doctor: { email: query.email } });
  }

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  if (query.searchTerm) {
    andConditions.push({
      doctor: {
        OR: [
          { name: { contains: query.searchTerm, mode: "insensitive" } },
          { email: { contains: query.searchTerm, mode: "insensitive" } },
          {
            specialization: { contains: query.searchTerm, mode: "insensitive" },
          },
        ],
      },
    });
  }

  const schedule = await prisma.schedule.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip: skip,
    orderBy: { [sortBy]: sortOrder },
    include: {
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  const totalSchedule = await prisma.schedule.count({
    where: { AND: andConditions },
  });

  return {
    data: schedule,
    meta: {
      page: page,
      limit: limit,
      total: totalSchedule,
      totalPages: Math.ceil(totalSchedule / limit),
    },
  };
};

const getScheduleById = async (scheduleId: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          email: true,
          specialization: true,
          userId: true,
        },
      },
      appointments: {
        include: {
          patient: true,
        },
      },
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new Error("Schedule is not found");
  }

  return schedule;
};

const updateSchedule = async (
  scheduleId: string,
  payload: IUpdateSchedulePayload,
  user: RequestUser,
) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new Error("Doctor profile not found");
  }

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new Error("Schedule is not found");
  }

  if (schedule.doctorId !== doctor.id) {
    throw new Error("You are not allowed to update this schedule");
  }

  if (
    schedule.status === ScheduleStatus.PUBLISHED &&
    schedule.totalSlots !== schedule.availableSlots
  ) {
    throw new Error(
      "Schedule once published and appointment booked cannot be update",
    );
  }

  payload.meetingLink = payload.meetingLink || schedule.meetingLink;
  payload.startDateTime = payload.startDateTime || schedule.startDateTime;
  payload.endDateTime = payload.endDateTime || schedule.endDateTime;

  const startOfTheDay = startOfDay(payload.startDateTime);
  const startOnNextDay = addDays(startOfTheDay, 1);

  const existingScheduleOnThisDate = await prisma.schedule.findFirst({
    where: {
      doctorId: doctor.id,
      isDeleted: false,
      startDateTime: {
        gte: startOfTheDay,
        lt: startOnNextDay,
      },
    },
  });

  if (existingScheduleOnThisDate) {
    throw new Error("You already have a schedule on this date");
  }

  const durationInMinutes = differenceInMinutes(
    payload.startDateTime,
    payload.endDateTime,
  );

  const minutesAllocatedPerSlots = 20;

  const totalSlots = Math.floor(durationInMinutes / minutesAllocatedPerSlots);

  const updatedSchedule = await prisma.schedule.update({
    where: {
      id: schedule.id,
    },
    data: {
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      meetingLink: payload.meetingLink,
      totalSlots,
      availableSlots: totalSlots,
      doctorId: doctor.id,
    },
    include: {
      doctor: {
        select: {
          name: true,
          email: true,
          contactNumber: true,
        },
      },
    },
  });

  return updatedSchedule;
};

const publishedSchedule = async (scheduleId: string, user: RequestUser) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
      doctorId: doctor.id,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new Error("Schedule not found");
  }

  if (schedule.status === ScheduleStatus.PUBLISHED) {
    throw new Error("This Schedule already published");
  }

  const publishedSchedule = await prisma.schedule.update({
    where: {
      id: schedule.id,
    },
    data: {
      status: ScheduleStatus.PUBLISHED,
    },
  });

  return publishedSchedule;
};

const deleteSchedule = async (scheduleId: string, user: RequestUser) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  const schedule = await prisma.schedule.findUnique({
    where: {
      id: scheduleId,
      doctorId: doctor.id,
    },
  });

  if (!schedule || schedule.isDeleted) {
    throw new Error("Schedule not found");
  }

  if (
    schedule.status === ScheduleStatus.PUBLISHED &&
    schedule.totalSlots !== schedule.availableSlots
  ) {
    throw new Error(
      "Schedule once published and appointment booked cannot be deleted",
    );
  }

  const deletedSchedule = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return deletedSchedule;
};

export const ScheduleService = {
  createSchedule,
  getMySchedule,
  getAllSchedule,
  getScheduleById,
  updateSchedule,
  publishedSchedule,
  deleteSchedule,
};
