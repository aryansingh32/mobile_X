import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { getBalance } from '../services/ledgerService';
import admin from '../config/firebase';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { getRequiredSecret } from '../config/secrets';
import { updateStreak } from '../services/expService';

const googleClient = new OAuth2Client();

function generateReferralCode(): string {
  return 'RF' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'ID token is required' });
      return;
    }

    let email: string | undefined;
    let googleId: string = '';
    let name: string | undefined;
    let picture: string | undefined;

    // Try Firebase ID token verification first, fall back to Google OAuth token
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      email = decodedToken.email;
      googleId = decodedToken.uid;
      name = decodedToken.name;
      picture = decodedToken.picture;
    } catch (firebaseError) {
      // Token is not a Firebase token — try verifying as a Google OAuth ID token
      console.log('Not a Firebase token, trying Google OAuth verification...');
      const clientId = process.env.GOOGLE_CLIENT_ID as string;
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        res.status(401).json({ error: 'Invalid token payload' });
        return;
      }
      email = payload.email;
      googleId = payload.sub || '';
      name = payload.name;
      picture = payload.picture;
    }

    if (!email) {
      res.status(400).json({ error: 'Email not available from Google account' });
      return;
    }

    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          name: name || 'User',
          referralCode: generateReferralCode(),
        }
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleId || null },
      });
    }

    const streakResult = await updateStreak(user.id);
    user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const jwtToken = jwt.sign({ id: user.id }, getRequiredSecret('JWT_SECRET'), { expiresIn: '30d' });

    const balance = await getBalance(user.id);

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        coins: balance,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        role: user.role,
        referralCode: user.referralCode
      },
      streakReset: streakResult.broken
    });
  } catch (error: any) {
    console.error('Google Auth Error:', error.message);
    res.status(401).json({ error: 'Invalid token. Please sign in again.' });
  }
};
