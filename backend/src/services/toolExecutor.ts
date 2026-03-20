// @ts-nocheck
import { prisma } from '../db';

// ─── GET BUSINESS DATA ────────────────────────────────────────────────────────

export async function executeGetBusinessData(params: {
  dataType: string;
  filters?: Record<string, any>;
}): Promise<any> {
  const { dataType, filters = {} } = params;

  switch (dataType) {
    case 'members': {
      const members = await prisma.member.findMany({
        where: filters.status ? { status: filters.status } : {},
        include: { enrollments: { include: { pool: true } } },
        orderBy: { fullName: 'asc' },
      });
      return members.map(m => ({
        id: m.id,
        name: m.fullName,
        phone: m.phone,
        status: m.status,
        riskLevel: m.riskLevel,
        pools: m.enrollments.map(e => e.pool.name),
      }));
    }

    case 'pools': {
      const pools = await prisma.pool.findMany({
        where: filters.status ? { status: filters.status } : {},
        include: { scheme: true },
        orderBy: { createdAt: 'desc' },
      });
      return pools.map(p => ({
        id: p.id,
        name: p.name,
        scheme: p.scheme.name,
        status: p.status,
        currentMonth: p.currentMonth,
        startDate: p.startDate,
      }));
    }

    case 'schemes': {
      const schemes = await prisma.scheme.findMany({ orderBy: { name: 'asc' } });
      return schemes.map(s => ({
        id: s.id,
        name: s.name,
        poolAmount: s.poolAmount,
        numberOfMembers: s.numberOfMembers,
        numberOfMonths: s.numberOfMonths,
      }));
    }

    case 'payments': {
      const payments = await prisma.payment.findMany({
        where: {
          ...(filters.month ? { month: Number(filters.month) } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.enrollmentId ? { enrollmentId: filters.enrollmentId } : {}),
        },
        include: { enrollment: { include: { member: true, pool: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return payments.map(p => ({
        id: p.id,
        member: p.enrollment.member.fullName,
        pool: p.enrollment.pool.name,
        month: p.month,
        amountDue: p.amountDue,
        amountPaid: p.amountPaid,
        status: p.status,
        paidAt: p.paidAt,
      }));
    }

    case 'unpaid_members': {
      const activePools = await prisma.pool.findMany({
        where: { status: 'ACTIVE' },
        include: {
          scheme: true,
          enrollments: {
            include: { member: true, payments: true },
          },
        },
      });

      const unpaid: any[] = [];
      for (const pool of activePools) {
        const schedule =
          typeof pool.scheme.paymentSchedule === 'string'
            ? JSON.parse(pool.scheme.paymentSchedule)
            : pool.scheme.paymentSchedule;
        const currentDueData = (schedule as any[]).find(
          (s: any) => s.month === pool.currentMonth
        );
        const amountDue = currentDueData?.amountDue ?? 0;

        for (const enr of pool.enrollments) {
          const hasPaid = enr.payments.some(p => p.month === pool.currentMonth);
          if (!hasPaid) {
            unpaid.push({
              memberName: enr.member.fullName,
              phone: enr.member.phone,
              pool: pool.name,
              month: pool.currentMonth,
              amountDue,
            });
          }
        }
      }
      return unpaid;
    }

    case 'defaulters': {
      const defaulters = await prisma.member.findMany({
        where: { status: 'DEFAULTER' },
        include: { enrollments: { include: { pool: true } } },
      });
      return defaulters.map(m => ({
        id: m.id,
        name: m.fullName,
        phone: m.phone,
        riskLevel: m.riskLevel,
        riskReason: m.riskReason,
        pools: m.enrollments.map(e => e.pool.name),
      }));
    }

    case 'pot_assignments': {
      const pots = await prisma.potAssignment.findMany({
        where: filters.poolId ? { poolId: filters.poolId } : {},
        include: {
          pool: true,
          enrollment: { include: { member: true } },
        },
        orderBy: { assignedAt: 'desc' },
      });
      return pots.map(p => ({
        id: p.id,
        pool: p.pool.name,
        member: p.enrollment.member.fullName,
        month: p.month,
        potAmount: p.potAmount,
        assignedAt: p.assignedAt,
      }));
    }

    case 'pool_summary': {
      const pools = await prisma.pool.findMany({
        where: { status: 'ACTIVE' },
        include: {
          scheme: true,
          enrollments: {
            include: {
              member: true,
              payments: true,
              potAssignments: true,
            },
          },
        },
      });

      return pools.map(pool => {
        const totalEnrolled = pool.enrollments.length;
        const potReceived = pool.enrollments.filter(e => e.potReceived).length;
        const paidThisMonth = pool.enrollments.filter(e =>
          e.payments.some(p => p.month === pool.currentMonth)
        ).length;
        return {
          pool: pool.name,
          scheme: pool.scheme.name,
          currentMonth: pool.currentMonth,
          totalMembers: totalEnrolled,
          paidThisMonth,
          unpaidThisMonth: totalEnrolled - paidThisMonth,
          potsAssigned: potReceived,
          potsRemaining: totalEnrolled - potReceived,
        };
      });
    }

    default:
      return { error: `Unknown dataType: ${dataType}` };
  }
}

// ─── CREATE SCHEME ────────────────────────────────────────────────────────────

export async function executeCreateScheme(params: {
  name: string;
  poolAmount: number;
  numberOfMembers?: number;
  numberOfMonths?: number;
  paymentSchedule?: Array<{ month: number; amountDue: number }>;
  payoutSchedule?: Array<{ month: number; potAmount: number }>;
}): Promise<any> {
  const {
    name,
    poolAmount,
    numberOfMembers = 20,
    numberOfMonths = 20,
  } = params;

  // Auto-generate flat schedules if not provided
  const monthlyPayment = Math.round(poolAmount / numberOfMonths);
  const paymentSchedule =
    params.paymentSchedule ??
    Array.from({ length: numberOfMonths }, (_, i) => ({
      month: i + 1,
      amountDue: monthlyPayment,
    }));
  const payoutSchedule =
    params.payoutSchedule ??
    Array.from({ length: numberOfMonths }, (_, i) => ({
      month: i + 1,
      potAmount: poolAmount,
    }));

  if (paymentSchedule.length !== numberOfMonths || payoutSchedule.length !== numberOfMonths) {
    return {
      success: false,
      reason: `Schedule lengths must match numberOfMonths (${numberOfMonths}). Got paymentSchedule: ${paymentSchedule.length}, payoutSchedule: ${payoutSchedule.length}`,
    };
  }

  const scheme = await prisma.scheme.create({
    data: {
      name,
      poolAmount,
      numberOfMembers,
      numberOfMonths,
      paymentSchedule: JSON.stringify(paymentSchedule),
      payoutSchedule: JSON.stringify(payoutSchedule),
    },
  });

  return { success: true, schemeId: scheme.id, name: scheme.name };
}

// ─── DELETE SCHEME ────────────────────────────────────────────────────────────

export async function executeDeleteScheme(params: {
  schemeId?: string;
  schemeName?: string;
}): Promise<any> {
  const { schemeId, schemeName } = params;

  const scheme = await prisma.scheme.findFirst({
    where: schemeId
      ? { id: schemeId }
      : { name: { contains: schemeName ?? '' } },
    include: { pools: true },
  });

  if (!scheme) {
    return { success: false, reason: 'Scheme not found.' };
  }

  const activePools = scheme.pools.filter(
    p => p.status === 'ACTIVE' || p.status === 'UPCOMING'
  );
  if (activePools.length > 0) {
    return {
      success: false,
      reason: `Cannot delete "${scheme.name}" — it has ${activePools.length} active/upcoming pool(s): ${activePools.map(p => p.name).join(', ')}.`,
    };
  }

  await prisma.scheme.delete({ where: { id: scheme.id } });
  return { success: true, deleted: scheme.name };
}

// ─── CREATE POOL ──────────────────────────────────────────────────────────────

export async function executeCreatePool(params: {
  name: string;
  schemeName: string;
  startDate: string;
}): Promise<any> {
  const { name, schemeName, startDate } = params;

  const scheme = await prisma.scheme.findFirst({
    where: { name: { contains: schemeName } },
  });

  if (!scheme) {
    return {
      success: false,
      reason: `No scheme found matching "${schemeName}". Available schemes can be fetched with get_business_data(dataType: "schemes").`,
    };
  }

  const pool = await prisma.pool.create({
    data: {
      name,
      schemeId: scheme.id,
      startDate: new Date(startDate),
      status: 'UPCOMING',
      currentMonth: 1,
    },
  });

  return {
    success: true,
    poolId: pool.id,
    name: pool.name,
    scheme: scheme.name,
    startDate: pool.startDate,
    status: pool.status,
  };
}

// ─── DELETE POOL ──────────────────────────────────────────────────────────────

export async function executeDeletePool(params: {
  poolId?: string;
  poolName?: string;
}): Promise<any> {
  const { poolId, poolName } = params;

  const pool = await prisma.pool.findFirst({
    where: poolId
      ? { id: poolId }
      : { name: { contains: poolName ?? '' } },
    include: {
      enrollments: { include: { payments: true } },
    },
  });

  if (!pool) {
    return { success: false, reason: 'Pool not found.' };
  }

  const hasPayments = pool.enrollments.some(e => e.payments.length > 0);
  if (hasPayments) {
    return {
      success: false,
      reason: `Cannot delete "${pool.name}" — it has existing payment records. Archive it instead by changing its status.`,
    };
  }

  // Delete enrollments (no payments exist), then the pool
  await prisma.enrollment.deleteMany({ where: { poolId: pool.id } });
  await prisma.pool.delete({ where: { id: pool.id } });

  return { success: true, deleted: pool.name };
}

// ─── SCHEDULE WHATSAPP REMINDER ───────────────────────────────────────────────

export async function executeScheduleReminder(params: {
  targetType: 'pool' | 'all_pools' | 'member';
  targetId?: string;
  targetName?: string;
  dayOfMonth: number;
  messageOverride?: string;
}): Promise<any> {
  const { targetType, targetId, targetName, dayOfMonth, messageOverride } = params;

  if (dayOfMonth < 1 || dayOfMonth > 28) {
    return { success: false, reason: 'dayOfMonth must be between 1 and 28.' };
  }

  let resolvedId = targetId;
  let resolvedName = targetName;

  if (!resolvedId && targetName && targetType === 'pool') {
    const pool = await prisma.pool.findFirst({
      where: { name: { contains: targetName } },
    });
    if (!pool) return { success: false, reason: `Pool "${targetName}" not found.` };
    resolvedId = pool.id;
    resolvedName = pool.name;
  } else if (!resolvedId && targetName && targetType === 'member') {
    const member = await prisma.member.findFirst({
      where: { fullName: { contains: targetName } },
    });
    if (!member) return { success: false, reason: `Member "${targetName}" not found.` };
    resolvedId = member.id;
    resolvedName = member.fullName;
  }

  // For all_pools there's no specific target
  if (targetType === 'all_pools') {
    resolvedId = undefined;
    resolvedName = 'All Pools';
  }

  const reminder = await prisma.scheduledReminder.create({
    data: {
      targetType,
      targetId: resolvedId ?? null,
      targetName: resolvedName ?? null,
      dayOfMonth,
      messageOverride: messageOverride ?? null,
      isActive: true,
    },
  });

  return {
    success: true,
    reminderId: reminder.id,
    targetType,
    targetName: resolvedName,
    dayOfMonth,
    message: `Reminder scheduled for day ${dayOfMonth} of every month.`,
  };
}

// ─── CANCEL SCHEDULED REMINDER ────────────────────────────────────────────────

export async function executeCancelReminder(params: {
  reminderId?: string;
  targetName?: string;
}): Promise<any> {
  const { reminderId, targetName } = params;

  const reminder = await prisma.scheduledReminder.findFirst({
    where: {
      ...(reminderId ? { id: reminderId } : {}),
      ...(targetName ? { targetName: { contains: targetName } } : {}),
      isActive: true,
    },
  });

  if (!reminder) {
    return { success: false, reason: 'Active reminder not found.' };
  }

  await prisma.scheduledReminder.update({
    where: { id: reminder.id },
    data: { isActive: false },
  });

  return {
    success: true,
    cancelled: reminder.targetName ?? reminder.targetType,
    reminderId: reminder.id,
  };
}

// ─── GET SCHEDULED REMINDERS ──────────────────────────────────────────────────

export async function executeGetScheduledReminders(): Promise<any> {
  const reminders = await prisma.scheduledReminder.findMany({
    where: { isActive: true },
    orderBy: { dayOfMonth: 'asc' },
  });

  return reminders.map(r => ({
    id: r.id,
    targetType: r.targetType,
    targetName: r.targetName,
    dayOfMonth: r.dayOfMonth,
    messageOverride: r.messageOverride,
    createdAt: r.createdAt,
  }));
}
