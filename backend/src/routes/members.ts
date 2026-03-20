// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Evaluate defaulter status dynamically
async function checkAndUpdateDefaulterStatus(memberId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { memberId },
    include: { pool: true, payments: true }
  });

  let isDefaulter = false;

  for (const enr of enrollments) {
    const currentMonth = enr.pool.currentMonth;
    if (currentMonth > 2) {
      // Check if they missed payment for currentMonth-1 and currentMonth-2
      const m1 = enr.payments.find(p => p.month === currentMonth - 1);
      const m2 = enr.payments.find(p => p.month === currentMonth - 2);
      
      if (!m1 && !m2) {
        isDefaulter = true;
        break;
      }
    }
  }

  // Also check if they are already completed (if they finished everything)
  // For simplicity, just set ACTIVE or DEFAULTER for now
  const newStatus = isDefaulter ? 'DEFAULTER' : 'ACTIVE';
  
  await prisma.member.update({
    where: { id: memberId },
    data: { status: newStatus }
  });

  return newStatus;
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      include: {
        enrollments: {
          include: { pool: { include: { scheme: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Optionally sync all on read (might be slow for thousands, but fine for now)
    for (const m of members) {
      m.status = await checkAndUpdateDefaulterStatus(m.id);
    }
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const member = await prisma.member.create({ data: req.body });
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Update status before returning
    await checkAndUpdateDefaulterStatus(req.params.id);
    
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        enrollments: {
          include: {
            pool: { include: { scheme: true } },
            payments: true,
            potAssignments: {
              include: { pool: true }
            }
          }
        }
      }
    });

    if (!member) return res.status(404).json({ message: 'Not Found' });

    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Check for active enrollments
    const enrollments = await prisma.enrollment.findMany({ where: { memberId: id } });
    if (enrollments.length > 0) {
      return res.status(400).json({ message: `Cannot delete — member has ${enrollments.length} active enrollment(s). Remove enrollments first.` });
    }
    await prisma.member.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;

