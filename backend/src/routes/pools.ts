// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const pools = await prisma.pool.findMany({
      include: { scheme: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pools);
  } catch (error) {
    console.error('Detailed error in pools.ts:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, schemeId, startDate } = req.body;
    const pool = await prisma.pool.create({
      data: { name, schemeId, startDate: new Date(startDate) }
    });
    res.json(pool);
  } catch (error) {
    console.error('Detailed error in pools.ts:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const pool = await prisma.pool.findUnique({
      where: { id: req.params.id },
      include: {
        scheme: true,
        enrollments: {
          include: { member: true },
          orderBy: { slotNumber: 'asc' }
        },
        potAssignments: {
          include: { enrollment: { include: { member: true } } },
          orderBy: { month: 'asc' }
        }
      }
    });
    if (!pool) return res.status(404).json({ message: 'Not found' });
    pool.scheme.paymentSchedule = JSON.parse(pool.scheme.paymentSchedule as unknown as string);
    pool.scheme.payoutSchedule = JSON.parse(pool.scheme.payoutSchedule as unknown as string);
    res.json(pool);
  } catch (error) {
    console.error('Detailed error in pools.ts:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, status, startDate } = req.body;
    const pool = await prisma.pool.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
      }
    });
    res.json(pool);
  } catch (error) {
    console.error('Detailed error in pools.ts:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Block if payment records exist
    const enrollments = await prisma.enrollment.findMany({
      where: { poolId: id },
      include: { payments: true }
    });
    const hasPayments = enrollments.some(e => e.payments.length > 0);
    if (hasPayments) {
      return res.status(400).json({ message: 'Cannot delete — pool has existing payment records.' });
    }
    // Delete pot assignments, enrollments, then pool
    await prisma.potAssignment.deleteMany({ where: { poolId: id } });
    await prisma.enrollment.deleteMany({ where: { poolId: id } });
    await prisma.pool.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
