import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import { sendPaymentReminders } from '../services/scheduler';
import { sendWhatsAppMessage } from '../services/whatsapp';

const router = Router();

// Get notification log
router.get('/log', authenticate, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50 // Limit to recent 50 for simplicity
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching notification log:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Manual trigger for current month reminders
router.post('/send-now', authenticate, async (req: Request, res: Response) => {
  try {
    // We execute this asynchronously so we don't block the request if it takes long
    sendPaymentReminders().then(() => {
      console.log('Manual reminder run completed.');
    }).catch(err => console.error('Manual reminder run failed:', err));
    
    res.json({ message: 'Reminder process started in the background.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Test message to owner
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.appSettings.findFirst();
    if (!settings || !settings.ownerPhone) {
      return res.status(400).json({ message: 'Owner phone number not set in settings.' });
    }

    const testMessage = `Hello from ${settings.companyName}!\n\nThis is a test message to verify your WhatsApp Cloud API integration is working correctly.`;
    
    const result = await sendWhatsAppMessage(settings.ownerPhone, testMessage);
    
    // Log the test message
    const log = await prisma.notificationLog.create({
      data: {
        memberName: 'Owner (Test)',
        phone: settings.ownerPhone,
        messageContent: testMessage,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error || null
      }
    });

    res.json({ success: result.success, log });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
