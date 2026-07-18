import prisma from '../config/db';
import logger from '../utils/logger';
import admin from '../config/firebase';

export const sendToUser = async (userId: number, title: string, body: string, type: string) => {
  try {
    // Log notification to DB
    await prisma.notification.create({
      data: { userId, title, body, type },
    });

    // Get user's FCM token
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });

    if (!user?.fcmToken) {
      logger.info(`No FCM token for user ${userId}, notification saved to DB only`);
      return;
    }

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: { type },
    });

    logger.info(`Notification sent to user ${userId}: ${title}`);
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}:`, error);
  }
};
