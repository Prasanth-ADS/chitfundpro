// @ts-nocheck
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { askAssistant, predictDefaultRisk, suggestPotAssignment } from '../services/aiService';
import { prisma } from '../db';

const router = Router();

// POST /api/ai/chat
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory, pendingToolCall, confirmed } = req.body;

    if (!message && !pendingToolCall) {
      return res.status(400).json({ error: 'Message or pendingToolCall is required' });
    }

    const result = await askAssistant(
      message || '',
      conversationHistory || [],
      pendingToolCall,
      confirmed
    );

    res.json(result);
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ type: 'reply', reply: 'Internal Server Error', error: true });
  }
});

// GET /api/ai/reminders — list all active scheduled reminders
router.get('/reminders', authenticate, async (req: Request, res: Response) => {
  try {
    const reminders = await prisma.scheduledReminder.findMany({
      where: { isActive: true },
      orderBy: { dayOfMonth: 'asc' },
    });
    res.json(reminders);
  } catch (error) {
    console.error('Reminders API Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/ai/risk/:memberId
router.get('/risk/:memberId', authenticate, async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const result = await predictDefaultRisk(memberId as string);
    res.json(result);
  } catch (error) {
    console.error('Risk API Error:', error);
    res.status(500).json({ risk: 'Unknown', reason: 'Internal server error' });
  }
});

// GET /api/ai/pot-suggestion/:poolId
router.get('/pot-suggestion/:poolId', authenticate, async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const result = await suggestPotAssignment(poolId as string);
    if (!result) return res.status(404).json({ message: 'No suggestion available' });
    res.json(result);
  } catch (error) {
    console.error('Pot Suggestion API Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
