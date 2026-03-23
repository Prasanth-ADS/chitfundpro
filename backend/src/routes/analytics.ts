import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/revenue-trend', authenticate, async (req: Request, res: Response) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const payments = await prisma.payment.groupBy({
      by: ['paidAt'],
      _sum: { amountPaid: true },
      where: { 
        paidAt: { gte: twelveMonthsAgo },
        status: 'PAID'
      }
    });
    res.json(payments);
  } catch (error) {
    console.error('Analytics Revenue Trend Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/cash-flow', authenticate, async (req: Request, res: Response) => {
  try {
    const breakdown = await prisma.payment.groupBy({
      by: ['paymentMode'],
      _sum: { amountPaid: true },
      where: { status: 'PAID' }
    });
    res.json(breakdown);
  } catch (error) {
    console.error('Analytics Cash Flow Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/pool-health', authenticate, async (req: Request, res: Response) => {
  try {
    // Basic placeholder implementation
    const pools = await prisma.pool.findMany({
      where: { status: 'ACTIVE' },
      include: {
        enrollments: {
          include: {
            payments: true
          }
        }
      }
    });
    res.json(pools);
  } catch (error) {
    console.error('Analytics Pool Health Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/member-behaviour', authenticate, async (req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      include: {
        enrollments: {
          include: { payments: true }
        }
      }
    });
    const stats = members.map(m => {
      const allPayments = m.enrollments.flatMap(e => e.payments);
      const onTime = allPayments.filter(p => p.status === 'PAID' && !p.lateFee).length;
      const total = allPayments.length;
      const reliability = total > 0 ? Math.round((onTime / total) * 100) : 100;
      return {
        memberId: m.id,
        name: m.fullName,
        reliability,
        category: reliability >= 90 ? 'Always on time' : reliability >= 70 ? 'Usually on time' : reliability >= 50 ? 'Occasionally late' : 'Frequently late'
      };
    });
    res.json(stats);
  } catch (error) {
    console.error('Analytics Member Behaviour Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
