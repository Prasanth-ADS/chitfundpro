// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const activePools = await prisma.pool.findMany({
      where: { status: 'ACTIVE' },
      include: { scheme: true, enrollments: { include: { payments: true } }, potAssignments: true }
    });

    const currentMonth = new Date().getMonth() + 1; // Simplified: actually we should use the pool's currentMonth

    // 1. Total active pools by scheme
    const activePoolsByScheme: Record<string, number> = {};
    activePools.forEach(p => {
      activePoolsByScheme[p.scheme.name] = (activePoolsByScheme[p.scheme.name] || 0) + 1;
    });

    // 2. Collection Progress (this month)
    let totalExpected = 0;
    let totalCollected = 0;
    let unpaidMembersCount = 0;
    const unpaidMembersSet = new Set<string>();

    activePools.forEach(pool => {
      const schedule = typeof pool.scheme.paymentSchedule === 'string'
        ? JSON.parse(pool.scheme.paymentSchedule)
        : pool.scheme.paymentSchedule;
      
      const currentDueData = schedule.find((s: any) => s.month === pool.currentMonth);
      const amountDue = currentDueData?.amountDue || 0;

      pool.enrollments.forEach(enr => {
        totalExpected += amountDue;
        const payment = enr.payments.find(p => p.month === pool.currentMonth);
        if (payment) {
          totalCollected += payment.amountPaid;
        } else {
          unpaidMembersSet.add(enr.memberId);
        }
      });
    });

    // 3. Unassigned Pots this month
    const unassignedPotsPools = activePools.filter(p => !p.potAssignments.some(pa => pa.month === p.currentMonth));

    // 4. Defaulters
    const defaulterCount = await prisma.member.count({ where: { status: 'DEFAULTER' } });

    // 5. Upcoming Completions (pools in month 18+)
    const upcomingCompletions = activePools.filter(p => p.currentMonth >= (p.scheme.numberOfMonths - 2));

    res.json({
      activePoolsByScheme,
      collectionProgress: { expected: totalExpected, collected: totalCollected },
      unpaidMembersCount: unpaidMembersSet.size,
      unassignedPotsPools: unassignedPotsPools.map(p => ({ id: p.id, name: p.name, currentMonth: p.currentMonth })),
      defaulterCount,
      upcomingCompletions: upcomingCompletions.map(p => ({ id: p.id, name: p.name, currentMonth: p.currentMonth, totalMonths: p.scheme.numberOfMonths }))
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
