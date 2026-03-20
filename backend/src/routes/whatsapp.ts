import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { whatsappState, initWhatsApp, logoutWhatsApp } from '../services/whatsapp';

const router = Router();

// Get WhatsApp connection status and QR code
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({
      status: whatsappState.status,
      qr: whatsappState.qr
    });
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Logout and clear WhatsApp auth
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await logoutWhatsApp();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out WhatsApp:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Reconnect
router.post('/reconnect', authenticate, async (req: Request, res: Response) => {
  try {
    initWhatsApp();
    res.json({ message: 'Reconnection triggered' });
  } catch (error) {
    console.error('Error reconnecting WhatsApp:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
