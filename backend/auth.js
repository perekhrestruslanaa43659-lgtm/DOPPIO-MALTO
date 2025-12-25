import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function updateUserProfile(userId, profileData) {
  const { name, email } = profileData;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
    });

    return updatedUser;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}