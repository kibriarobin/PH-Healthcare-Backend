import { addMinutes, format, isBefore, isSameDay } from "date-fns";
import {
  AppointmentStatus,
  PaymentStatus,
  ScheduleStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBKashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import type { IBookAppointmentPayload } from "./appointment.interface";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import ejs from "ejs";

const bookAppointment = async (
  payload: IBookAppointmentPayload,
  user: RequestUser,
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const patient = await prisma.patient.findUnique({
      where: {
        id: user.userId,
      },
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: payload.scheduleId },
      include: { doctor: true },
    });

    if (!schedule || schedule.isDeleted) {
      throw new Error("schedule not found");
    }

    if (schedule.status !== ScheduleStatus.PUBLISHED) {
      throw new Error("this schedule is not published yet");
    }

    const now = new Date();

    if (!isSameDay(now, schedule.startDateTime)) {
      throw new Error("This schedule is not available for today");
    }

    if (!isBefore(now, schedule.startDateTime)) {
      throw new Error("This schedule has already started");
    }

    // if(isAfter(now, schedule.startDateTime)){
    //   throw new Error("This schedule has already started")
    // }

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        scheduleId: schedule.id,
      },
    });

    if (existingAppointment?.status === AppointmentStatus.PENDING) {
      throw new Error(
        "You already have a pending appointment. Please pay for that.",
      );
    }

    if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
      throw new Error("You already have a confirmed appointment.");
    }

    if (existingAppointment?.status === AppointmentStatus.ONGOING) {
      throw new Error("You already have an ongoing appointment.");
    }

    if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
      throw new Error(
        "You already completed an appointment on this schedule. Please try again another day.",
      );
    }

    if (schedule.availableSlots === 0) {
      throw new Error("This schedule is fully booked");
    }

    if (!schedule.doctor.consultationFee) {
      throw new Error("This doctor has not set a consultation fee yet");
    }

    const amount = schedule.doctor.consultationFee.toString();

    const appointment = await tx.appointment.create({
      data: {
        status: AppointmentStatus.PENDING,
        patientId: patient.id,
        doctorId: schedule.doctor.id,
        scheduleId: schedule.id,
      },
    });

    const bkashIdToken = await getBKashIdToken();

    if (!bkashIdToken || typeof bkashIdToken !== "string") {
      throw new Error("Bkash access token not found");
    }

    const bkashCreatePaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
          mode: "0011",
          payerReference: user.email, // user email or phone
          callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
          merchantAssociationInfo: "MI05MID54RF09123456One",
          amount: amount,
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: appointment.id, //appointment id
        }),
      },
    );

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

    // payment model create
    await tx.payment.create({
      data: {
        merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
        appointmentId: appointment.id,
        amount: amount,
        gateWayResponse: bkashCreatePaymentResult,
        bkashPaymentId: bkashCreatePaymentResult.paymentID,
        payerReference: user.email,
      },
    });

    return {
      paymentURL: bkashCreatePaymentResult.bkashURL,
    };
  });

  return transactionResult;
};

const payAppointment = async (payload: any, user: RequestUser) => {
  const appointmentId = payload.appointmentId;

  const existingAppointment = await prisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
    include: {
      schedule: {
        include: {
          doctor: true,
        },
      },
    },
  });

  if (!existingAppointment) {
    throw new Error("Appointment does not exists");
  }

  if (existingAppointment.status !== "PENDING") {
    throw new Error("You can only pay for pending appointment");
  }

  if (!existingAppointment.schedule.doctor.consultationFee) {
    throw new Error("Doctor has not set consultation fee yet.");
  }

  const amount =
    existingAppointment.schedule.doctor.consultationFee?.toString();

  const bkashIdToken = await getBKashIdToken();

  if (!bkashIdToken || typeof bkashIdToken !== "string") {
    throw new Error("Bkash access token not found");
  }

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
        mode: "0011",
        payerReference: user.email, // user email or phone
        callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
        merchantAssociationInfo: "MI05MID54RF09123456One",
        amount: amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: existingAppointment.id, //appointment id
      }),
    },
  );

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  await prisma.payment.update({
    where: {
      appointmentId: existingAppointment.id,
    },
    data: {
      merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
      gateWayResponse: bkashCreatePaymentResult,
      bkashPaymentId: bkashCreatePaymentResult.paymentID,
    },
  });

  return {
    paymentURL: bkashCreatePaymentResult.bkashURL,
  };
};

const bookAppointmentCallback = async (query: Record<string, any>) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const paymentId = query.paymentID;

    if (!paymentId) {
      throw new Error("Payment id is missing");
    }

    const paymentStatus = query.status;

    if (!paymentStatus) {
      throw new Error("Payment status is missing");
    }

    const bkashIdToken = await getBKashIdToken();

    if (!bkashIdToken || typeof bkashIdToken !== "string") {
      throw new Error("Bkash access token not found");
    }

    const executedPaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: paymentId,
        }),
      },
    );

    const executedPaymentResult = await executedPaymentResponse.json();

    if (paymentStatus === "success") {
      const appointment = await prisma.appointment.findUnique({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber,
        },
        include: {
          schedule: true,
          patient: true,
          doctor: true,
        },
      });

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      const newAvailableSlots = appointment.schedule.availableSlots - 1;

      const alreadyBookedSlots =
        appointment.schedule.totalSlots - appointment.schedule.availableSlots;

      const serialNumber = alreadyBookedSlots + 1;

      const joiningTime = addMinutes(
        appointment.schedule.startDateTime,
        (serialNumber - 1) * 20,
      );

      await tx.appointment.update({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber,
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
          joiningTime,
          serialNumber,
        },
      });

      await tx.schedule.update({
        where: { id: appointment.scheduleId },
        data: {
          availableSlots: newAvailableSlots,
        },
      });
      await tx.payment.update({
        where: {
          appointmentId: executedPaymentResult.merchantInvoiceNumber,
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: executedPaymentResult.trxID,
          paidAt: executedPaymentResult.paymentExecuteTime,
          gateWayResponse: executedPaymentResult,
        },
      });

      const templateFilePath = path.join(
        process.cwd(),
        "src/app/templates/appointment-confirmation.ejs",
      );

      const templateData = {
        patientName: appointment.patient.name,
        doctorName: appointment.doctor.name,
        appointmentDate: format(joiningTime, "dd MMM yyyy"),
        appointmentTime: format(joiningTime, "hh:mm a"),
      };

      const html = await ejs.renderFile(templateFilePath, templateData);

      await transporter.sendMail({
        from: config.email_sender,
        to: appointment.patient.email,
        subject: "Your Appointment is Confirmed - PH Healthcare",
        html,
      });

      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
      };
    } else if (paymentStatus === "failure") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.FAILED,
          gateWayResponse: executedPaymentResult,
        },
      });

      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
      };
    } else if (paymentStatus === "cancel") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          gateWayResponse: executedPaymentResult,
        },
      });

      return {
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
      };
    } else {
      return {
        executedPaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
      };
    }
  });

  return transactionResult;
};

const cancelAppointment = async (payload: any) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const appointmentId = payload.appointmentId;

    const existingAppointment = await tx.appointment.findUnique({
      where: {
        id: appointmentId,
      },
      include: {
        payment: true,
      },
    });

    if (!existingAppointment) {
      throw new Error("Appointment does not exists");
    }

    if (
      existingAppointment.status === "ONGOING" ||
      existingAppointment.status === "COMPLETED"
    ) {
      throw new Error("You can not cancel ongoing or completed appointment");
    }

    if (existingAppointment.status === "CANCELLED") {
      throw new Error("Appointment already canceled");
    }

    const updateAppointment = await tx.appointment.update({
      where: {
        id: existingAppointment.id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    const bkashIdToken = await getBKashIdToken();

    if (!bkashIdToken || typeof bkashIdToken !== "string") {
      throw new Error("Bkash access token not found");
    }

    const bkashRefundPaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/payment/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: existingAppointment.payment?.bkashPaymentId,
          trxID: existingAppointment.payment?.bkashTrxId,
          amount: existingAppointment.payment?.amount.toString(),
          sku: "Appointment cancellation",
          reason: "Patient canceled the appointment",
        }),
      },
    );

    const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

    const updatePayment = await tx.payment.update({
      where: {
        appointmentId: existingAppointment.id,
      },
      data: {
        refundTrxId: bkashRefundPaymentResult.refundTrxID,
        refundedAt: bkashRefundPaymentResult.completedTime,
        refundReason: "Patient canceled the appointment",
        refundAmount: bkashRefundPaymentResult.amount,
        status: "REFUNDED",
        gateWayResponse: bkashRefundPaymentResult,
      },
    });

    return {
      appointment: updateAppointment,
      payment: updatePayment,
    };
  });

  return transactionResult;
};

export const AppointmentService = {
  bookAppointment,
  payAppointment,
  bookAppointmentCallback,
  cancelAppointment,
};
