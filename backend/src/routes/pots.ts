// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get pot assignments for a pool
router.get('/pool/:poolId', authenticate, async (req: Request, res: Response) => {
  try {
    const assignments = await prisma.potAssignment.findMany({
      where: { poolId: req.params.poolId },
      include: { enrollment: { include: { member: true } } },
      orderBy: { month: 'asc' }
    });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Assign a pot to a member for a specific month
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { poolId, month, enrollmentId, potAmount, paymentMode, notes, assignedAt } = req.body;

    const existing = await prisma.potAssignment.findUnique({
      where: { poolId_month: { poolId, month } }
    });

    if (existing) {
      return res.status(400).json({ message: 'Pot for this month is already assigned and locked.' });
    }

    // Create the assignment
    const assignment = await prisma.potAssignment.create({
      data: {
        poolId,
        month,
        enrollmentId,
        potAmount,
        paymentMode: paymentMode || 'BANK',
        notes: notes || '',
        assignedAt: assignedAt ? new Date(assignedAt) : new Date()
      }
    });

    // Update the enrollment to potReceived = true
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        potReceived: true,
        potReceivedMonth: month
      }
    });

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Owner override (unlock/reassign) - update the assignment and fix enrollment flags
router.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      // Get the current assignment to know the old enrollment
      const current = await prisma.potAssignment.findUnique({
        where: { id: req.params.id }
      });
      if (!current) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      const { enrollmentId, potAmount, paymentMode, notes } = req.body;

      // If the member is being changed, reset old enrollment and set new one
      if (enrollmentId && enrollmentId !== current.enrollmentId) {
        // Reset old enrollment
        await prisma.enrollment.update({
          where: { id: current.enrollmentId },
          data: { potReceived: false, potReceivedMonth: null }
        });
        // Set new enrollment
        await prisma.enrollment.update({
          where: { id: enrollmentId },
          data: { potReceived: true, potReceivedMonth: current.month }
        });
      }

      const assignment = await prisma.potAssignment.update({
        where: { id: req.params.id },
        data: {
          ...(enrollmentId && { enrollmentId }),
          ...(potAmount !== undefined && { potAmount }),
          ...(paymentMode && { paymentMode }),
          ...(notes !== undefined && { notes }),
        },
        include: { enrollment: { include: { member: true } } }
      });
      res.json(assignment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

export default router;
