// @ts-nocheck
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const schemes = await prisma.scheme.findMany({ orderBy: { createdAt: 'desc' } });
    const parsedSchemes = schemes.map(s => ({
      ...s,
      paymentSchedule: JSON.parse(s.paymentSchedule),
      payoutSchedule: JSON.parse(s.payoutSchedule)
    }));
    res.json(parsedSchemes);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, poolAmount, numberOfMembers = 20, numberOfMonths = 20, paymentSchedule, payoutSchedule } = req.body;
    // Auto-generate flat schedules if not provided
    const monthlyPayment = Math.round(poolAmount / numberOfMonths);
    const ps = paymentSchedule ?? Array.from({ length: numberOfMonths }, (_, i) => ({ month: i + 1, amountDue: monthlyPayment }));
    const pos = payoutSchedule ?? Array.from({ length: numberOfMonths }, (_, i) => ({ month: i + 1, potAmount: poolAmount }));
    const scheme = await prisma.scheme.create({
      data: {
        name,
        poolAmount: Number(poolAmount),
        numberOfMembers: Number(numberOfMembers),
        numberOfMonths: Number(numberOfMonths),
        paymentSchedule: JSON.stringify(ps),
        payoutSchedule: JSON.stringify(pos)
      }
    });
    res.json({ ...scheme, paymentSchedule: ps, payoutSchedule: pos });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const scheme = await prisma.scheme.findUnique({ where: { id: req.params.id } });
    if (!scheme) return res.status(404).json({ message: 'Not found' });
    res.json({
      ...scheme,
      paymentSchedule: JSON.parse(scheme.paymentSchedule),
      payoutSchedule: JSON.parse(scheme.payoutSchedule)
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const scheme = await prisma.scheme.update({
      where: { id: req.params.id },
      data: { ...(name !== undefined && { name }) }
    });
    res.json({ ...scheme, paymentSchedule: JSON.parse(scheme.paymentSchedule), payoutSchedule: JSON.parse(scheme.payoutSchedule) });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activePools = await prisma.pool.findMany({
      where: { schemeId: id, status: { in: ['ACTIVE', 'UPCOMING'] } }
    });
    if (activePools.length > 0) {
      return res.status(400).json({ message: `Cannot delete — scheme has ${activePools.length} active/upcoming pool(s).` });
    }
    await prisma.scheme.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
