// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { memberId, poolId } = req.body;

    // 1. Check if member already in pool
    const existing = await prisma.enrollment.findUnique({
      where: { memberId_poolId: { memberId, poolId } }
    });
    if (existing) return res.status(400).json({ message: 'Member already enrolled in this pool' });

    // 2. Check if member has 3 active pools max
    const memberActiveEnrollments = await prisma.enrollment.count({
      where: { memberId, pool: { status: { in: ['UPCOMING', 'ACTIVE'] } } }
    });
    if (memberActiveEnrollments >= 3) {
      return res.status(400).json({ message: 'Member cannot be actively enrolled in more than 3 pools' });
    }

    // 3. Check if pool has > 20 members
    const poolEnrollments = await prisma.enrollment.findMany({
      where: { poolId },
      orderBy: { slotNumber: 'asc' }
    });
    if (poolEnrollments.length >= 20) {
      return res.status(400).json({ message: 'Pool is already full (20 members max)' });
    }

    // Determine slot number (find first available)
    const usedSlots = new Set(poolEnrollments.map(e => e.slotNumber));
    let slotNumber = 1;
    for (let i = 1; i <= 20; i++) {
      if (!usedSlots.has(i)) {
        slotNumber = i;
        break;
      }
    }

    const enrollment = await prisma.enrollment.create({
      data: { memberId, poolId, slotNumber }
    });

    res.json(enrollment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
