// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all 20 members' status for a specific pool & month
router.get('/pool/:poolId/month/:month', authenticate, async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const month = parseInt(req.params.month, 10);

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { scheme: true, enrollments: { include: { member: true, payments: { where: { month } } } } }
    });

    if (!pool) return res.status(404).json({ message: 'Pool not found' });

    // Calculate amount due based on scheme schedule
    const schedule = typeof pool.scheme.paymentSchedule === 'string' 
      ? JSON.parse(pool.scheme.paymentSchedule) 
      : pool.scheme.paymentSchedule;
    
    const currentDueData = schedule.find((s: any) => s.month === month);
    const amountDue = currentDueData?.amountDue || 0;

    // Map 20 members
    const membersStatus = pool.enrollments.map(enr => {
      const payment = enr.payments[0]; // because we filtered by month
      return {
        enrollmentId: enr.id,
        memberId: enr.member.id,
        memberName: enr.member.fullName,
        riskLevel: enr.member.riskLevel,
        riskReason: enr.member.riskReason,
        slotNumber: enr.slotNumber,
        amountDue,
        amountPaid: payment?.amountPaid || 0,
        lateFee: payment?.lateFee || 0,
        paymentMode: payment?.paymentMode || 'NONE',
        status: payment?.status || 'UNPAID', // Inferred UNPAID if no record
        notes: payment?.notes || '',
        paymentDate: payment?.paidAt || null
      };
    });

    res.json(membersStatus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Record a Payment
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { enrollmentId, month, amountDue, amountPaid, lateFee, paymentMode, status, notes, paymentDate } = req.body;

    const existing = await prisma.payment.findUnique({
      where: { enrollmentId_month: { enrollmentId, month } }
    });

    const data = {
      enrollmentId,
      month,
      amountDue,
      amountPaid,
      lateFee: lateFee || 0,
      paymentMode: paymentMode || 'CASH',
      status: status || 'PAID',
      notes: notes || '',
      paidAt: paymentDate ? new Date(paymentDate) : new Date()
    };

    let payment;
    if (existing) {
      payment = await prisma.payment.update({
        where: { id: existing.id },
        data
      });
    } else {
      payment = await prisma.payment.create({ data });
    }

    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Daily Cash Summary
router.get('/summary/daily', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: {
        paidAt: {
          gte: today,
        }
      }
    });

    const summary = {
      CASH: 0,
      UPI: 0,
      BANK: 0,
      TOTAL: 0
    };

    payments.forEach(p => {
      const totalAmount = p.amountPaid + p.lateFee;
      if (p.paymentMode === 'CASH') summary.CASH += totalAmount;
      else if (p.paymentMode === 'UPI') summary.UPI += totalAmount;
      else if (p.paymentMode === 'BANK') summary.BANK += totalAmount;
      
      summary.TOTAL += totalAmount;
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
