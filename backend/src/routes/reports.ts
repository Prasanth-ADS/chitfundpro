// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// 1. Member Passbook
router.get('/member-passbook/:memberId/:poolId', authenticate, async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const poolId = req.params.poolId as string;
    const enrollment = await prisma.enrollment.findUnique({
      where: { memberId_poolId: { memberId, poolId } },
      include: {
        member: true,
        pool: { include: { scheme: true } },
        payments: { orderBy: { month: 'asc' } },
        potAssignments: true
      }
    });

    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });

    const schedule = typeof enrollment.pool.scheme.paymentSchedule === 'string'
      ? JSON.parse(enrollment.pool.scheme.paymentSchedule)
      : enrollment.pool.scheme.paymentSchedule;

    const reportData = schedule.map((s: any) => {
      const payment = enrollment.payments.find(p => p.month === s.month);
      return {
        month: s.month,
        amountDue: s.amountDue,
        amountPaid: payment?.amountPaid || 0,
        mode: payment?.paymentMode || '-',
        date: payment?.paidAt || null,
        status: payment?.status || 'UNPAID'
      };
    });

    res.json({
      member: enrollment.member.fullName,
      pool: enrollment.pool.name,
      entries: reportData,
      summary: {
        totalPaid: enrollment.payments.reduce((acc, p) => acc + p.amountPaid, 0),
        potReceived: enrollment.potReceived,
        potReceivedMonth: enrollment.potReceivedMonth
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 2. Pool Summary
router.get('/pool-summary/:poolId', authenticate, async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        scheme: true,
        enrollments: { include: { payments: true } },
        potAssignments: true
      }
    });

    if (!pool) return res.status(404).json({ message: 'Pool not found' });

    const summary = Array.from({ length: pool.scheme.numberOfMonths }, (_, i) => {
      const month = i + 1;
      const totalCollected = pool.enrollments.reduce((acc, enr) => {
        const p = enr.payments.find(pm => pm.month === month);
        return acc + (p?.amountPaid || 0);
      }, 0);
      const potPaid = pool.potAssignments.find(pa => pa.month === month)?.potAmount || 0;

      return {
        month,
        totalCollected,
        potPaid,
        balance: totalCollected - potPaid
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 3. Defaulters Report
router.get('/defaulters', authenticate, async (req: Request, res: Response) => {
  try {
    const defaulters = await prisma.member.findMany({
      where: { status: 'DEFAULTER' },
      include: {
        enrollments: {
          include: {
            pool: true,
            payments: true
          }
        }
      }
    });

    const report = defaulters.flatMap(m => 
      m.enrollments.map(enr => {
        const missedMonths = Array.from({ length: enr.pool.currentMonth }, (_, i) => i + 1)
          .filter(m => !enr.payments.some(p => p.month === m));

        return {
          name: m.fullName,
          phone: m.phone,
          pool: enr.pool.name,
          missedCount: missedMonths.length,
          lastPayment: enr.payments.length > 0 ? enr.payments.sort((a,b) => b.paidAt.getTime() - a.paidAt.getTime())[0].paidAt : null
        };
      })
    );

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 4. Monthly Collection Report
router.get('/monthly-collection', authenticate, async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    const year = req.query.year as string;
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0);

    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate }
      },
      include: { enrollment: { include: { pool: true } } }
    });

    const grouped = payments.reduce((acc: any, p) => {
      const poolName = p.enrollment.pool.name;
      if (!acc[poolName]) acc[poolName] = { CASH: 0, UPI: 0, BANK: 0, total: 0 };
      acc[poolName][p.paymentMode] += p.amountPaid;
      acc[poolName].total += p.amountPaid;
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 5. Pool Closure Report
router.get('/pool-closure/:poolId', authenticate, async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { enrollments: { include: { payments: true } }, potAssignments: true }
    });

    if (!pool) return res.status(404).json({ message: 'Pool not found' });

    const totalCollected = pool.enrollments.reduce((acc, enr) => 
      acc + enr.payments.reduce((pAcc, p) => pAcc + p.amountPaid, 0), 0);
    
    const totalPaidOut = pool.potAssignments.reduce((acc, pa) => acc + pa.potAmount, 0);

    res.json({
      poolName: pool.name,
      totalCollected,
      totalPaidOut,
      commission: totalCollected - totalPaidOut
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 6. Yearly Profit Report
router.get('/yearly-profit', authenticate, async (req: Request, res: Response) => {
  try {
    const year = req.query.year as string;
    const startDate = new Date(Number(year), 0, 1);
    const endDate = new Date(Number(year), 11, 31);

    const pools = await prisma.pool.findMany({
      include: { enrollments: { include: { payments: true } }, potAssignments: true }
    });

    const profitData = pools.map(pool => {
      const yearCollected = pool.enrollments.reduce((acc, enr) => 
        acc + enr.payments.filter(p => p.paidAt >= startDate && p.paidAt <= endDate)
          .reduce((pAcc, p) => pAcc + p.amountPaid, 0), 0);
      
      const yearPaidOut = pool.potAssignments.filter(pa => pa.assignedAt >= startDate && pa.assignedAt <= endDate)
        .reduce((acc, pa) => acc + pa.potAmount, 0);

      return {
        poolName: pool.name,
        profit: yearCollected - yearPaidOut
      };
    });

    res.json({
      pools: profitData,
      totalProfit: profitData.reduce((acc, p) => acc + p.profit, 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
