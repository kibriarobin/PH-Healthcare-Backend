import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfilePhoto = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      profilePhoto: true,
      photoPublicId: true,
    },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, async (error, result) => {
          if (error) {
            return reject(error);
          }

          if (!result) {
            return reject("No result return from cloudinary");
          }
          resolve(result);
        })
        .end(buffer);
    },
  );

  const updateUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      profilePhoto: cloudinaryResult?.secure_url,
      photoPublicId: cloudinaryResult?.public_id,
    },
    omit: {
      password: true,
    },
  });


  if(currentUser?.profilePhoto && currentUser.photoPublicId){
    await cloudinary.uploader.destroy(currentUser.photoPublicId)
  }

  return updateUser;
};

export const UserService = {
  uploadProfilePhoto,
};
