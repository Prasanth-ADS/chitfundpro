import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersafejwtsecret12345';

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'prasanthselvaads@gmail.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '75300@Prx';
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  return res.json({ 
    message: 'Logged in successfully',
    token: token 
  });
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ email: req.email });
});

export default router;
