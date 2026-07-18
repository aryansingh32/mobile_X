import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import requestIp from 'request-ip';
import { logFraud } from '../services/fraudService';
import { sendServerError } from '../utils/errorResponse';
import { google } from 'googleapis';
import logger from '../utils/logger';

const getPlayIntegrityClient = async () => {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/playintegrity'],
  });
  return google.playintegrity({ version: 'v1', auth });
};

export const registerFingerprint = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const clientIp = requestIp.getClientIp(req) || 'unknown';
    
    const { 
      deviceModel, 
      manufacturer, 
      osVersion, 
      isRooted, 
      isEmulator, 
      timezone,
      locale,
      hardwareId,
      playIntegrityToken,
      aaid,
      gsfId
    } = req.body;

    // Create a deterministic hash of the device hardware to track clones
    const deviceHash = crypto.createHash('sha256')
      .update(`${hardwareId}-${deviceModel}-${manufacturer}`)
      .digest('hex');

    let deviceTrustScore = 100;
    
    if (isEmulator) deviceTrustScore -= 80;
    if (aaid === "unknown" || gsfId === "unknown") deviceTrustScore -= 20;
    if (isRooted) deviceTrustScore -= 50;

    if (playIntegrityToken && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const playIntegrity = await getPlayIntegrityClient();
        const response = await playIntegrity.v1.decodeIntegrityToken({
          packageName: process.env.ANDROID_PACKAGE_NAME || 'com.reelflow.app',
          requestBody: {
            integrityToken: playIntegrityToken,
          },
        });

        const payload = response.data.tokenPayloadExternal;
        
        const appVerdict = payload?.appIntegrity?.appRecognitionVerdict;
        if (appVerdict !== 'RECOGNIZED') {
          deviceTrustScore -= 50;
        }

        const deviceVerdicts = payload?.deviceIntegrity?.deviceRecognitionVerdict || [];
        if (!deviceVerdicts.includes('MEETS_BASIC_INTEGRITY')) {
          deviceTrustScore -= 30;
        }
      } catch (err: any) {
        logger.warn('Play Integrity Verification Failed', { error: err.message });
      }
    }

    // Save or update THIS user's footprint for THIS device. Deliberately
    // keyed on (userId, deviceIdHash) — not deviceIdHash alone — so that
    // when a different user registers the same physical device, it creates
    // its own row instead of overwriting/hiding the original one. That's
    // what makes the cross-user check below possible at all.
    const device = await prisma.deviceFingerprint.upsert({
      where: { userId_deviceIdHash: { userId, deviceIdHash: deviceHash } },
      update: {
        lastIpAddress: clientIp,
        osVersion,
        timezone,
        trustScore: deviceTrustScore
      },
      create: {
        userId,
        deviceIdHash: deviceHash,
        osVersion: osVersion || 'unknown',
        isRooted: !!isRooted,
        isEmulator: !!isEmulator,
        lastIpAddress: clientIp,
        timezone: timezone || 'unknown',
        trustScore: deviceTrustScore
      }
    });

    // Check for Device Cloning (Same deviceHash used by completely different users)
    const usersOnDevice = await prisma.deviceFingerprint.findMany({
      where: { deviceIdHash: deviceHash },
      select: { userId: true }
    });

    const uniqueUsers = new Set(usersOnDevice.map(d => d.userId));
    if (uniqueUsers.size > 2) {
      await logFraud(userId, 'DEVICE_CLONING_FARM', 'CRITICAL', { deviceHash, users: Array.from(uniqueUsers) });
      
      // Auto Ban user if they are part of a massive device farm
      await prisma.user.update({
        where: { id: userId },
        data: { riskScore: 100, banned: true }
      });
    }

    res.json({ message: 'Device registered securely', trustScore: deviceTrustScore });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
