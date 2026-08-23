export interface IApplyDoctorPayload {
  name: string;
  email: string;
  address?: string;
  bio?: string;
  specialization: string;
  licenseNumber: string;
  qualifications: string;
  experienceYears: number;
  consultationFee?: number;
  contactNumber?: string;
}