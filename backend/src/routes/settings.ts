import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import { rescheduleReminder } from '../services/scheduler';

const router = Router();

// Get settings
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    let settings = await prisma.appSettings.findFirst();
    
    // Create defaults if not exists
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          id: 'singleton',
          reminderDay: 5,
          autoReminders: false,
          companyName: 'ChitFund Pro',
          ownerPhone: ''
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update settings
router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { reminderDay, autoReminders, companyName, ownerPhone } = req.body;
    
    // Upsert singleton
    const settings = await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: {
        reminderDay: parseInt(reminderDay, 10),
        autoReminders: Boolean(autoReminders),
        companyName,
        ownerPhone
      },
      create: {
        id: 'singleton',
        reminderDay: parseInt(reminderDay, 10),
        autoReminders: Boolean(autoReminders),
        companyName,
        ownerPhone
      }
    });

    // If day changed, reschedule cron
    rescheduleReminder(settings.reminderDay);

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
