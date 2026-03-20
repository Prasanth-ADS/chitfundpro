import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../db';
import { sendWhatsAppMessage } from './whatsapp';
import { generatePersonalizedReminder, generateMonthlySummary } from './aiService';

let currentTask: ScheduledTask | null = null;

export const sendPaymentReminders = async () => {
  try {
    const settings = await prisma.appSettings.findFirst();
    if (!settings || !settings.autoReminders) {
      console.log('Auto reminders are disabled in settings.');
      return;
    }

    // Find all active pools and their enrollments
    const activePools = await prisma.pool.findMany({
      where: { status: 'ACTIVE' },
      include: {
        scheme: true,
        enrollments: {
          include: {
            member: true,
            payments: true
          }
        }
      }
    });

    const duesByMember = new Map<string, { member: any, dues: any[] }>();

    for (const pool of activePools) {
      const currentMonth = pool.currentMonth;
      
      const schedule = typeof pool.scheme.paymentSchedule === 'string'
        ? JSON.parse(pool.scheme.paymentSchedule)
        : pool.scheme.paymentSchedule;
        
      const currentDueData = schedule.find((s: any) => s.month === currentMonth);
      if (!currentDueData) continue;
      
      const amountDue = currentDueData.amountDue;

      for (const enr of pool.enrollments) {
        // Check if paid for current month
        const hasPaid = enr.payments.some(p => p.month === currentMonth);
        
        if (!hasPaid) {
          const memberId = enr.member.id;
          if (!duesByMember.has(memberId)) {
            duesByMember.set(memberId, { member: enr.member, dues: [] });
          }
          
          duesByMember.get(memberId)!.dues.push({
            poolName: pool.name,
            amount: amountDue,
            month: currentMonth,
            totalMonths: pool.scheme.numberOfMonths
          });
        }
      }
    }

    for (const { member, dues } of duesByMember.values()) {
      const totalDue = dues.reduce((sum, d) => sum + d.amount, 0);
      
      // Determine tone based on risk
      let tone: 'Friendly' | 'Urgent' | 'Professional' = 'Friendly';
      if (member.riskLevel === 'High') tone = 'Urgent';
      else if (member.riskLevel === 'Medium') tone = 'Professional';

      let message = await generatePersonalizedReminder(member.fullName, totalDue, dues, tone);
      
      if (message) {
        // Replace company name placeholder if AI didn't do it right
        message = message.replace(/\[Company Name\]/g, settings.companyName);
      } else {
        // Fallback to static template
        message = `Hello ${member.fullName} 👋\n\nThis is a reminder that the following chit payments are due:\n\n`;
        for (const due of dues) {
          message += `🏦 Pool: ${due.poolName}\n💰 Amount Due: ₹${due.amount.toLocaleString()}\n📅 Month: ${due.month} of ${due.totalMonths}\n\n`;
        }
        message += `Please make your payments at the earliest.\n\nThank you,\n${settings.companyName}`;
      }

      // Send via WhatsApp
      const result = await sendWhatsAppMessage(member.phone, message);

      // Log it
      await prisma.notificationLog.create({
        data: {
          memberName: member.fullName,
          phone: member.phone,
          messageContent: message,
          status: result.success ? 'SENT' : 'FAILED',
          errorMessage: result.error || null
        }
      });
    }

    console.log(`Sent ${duesByMember.size} payment reminders.`);
  } catch (error) {
    console.error('Error sending payment reminders:', error);
  }
};

export const sendMonthlyBusinessSummary = async () => {
  try {
    const settings = await prisma.appSettings.findFirst();
    if (!settings || !settings.ownerPhone) return;

    const currentMonthDate = new Date();
    const currentMonthNum = currentMonthDate.getMonth() + 1; // 1-indexed

    // Gather monthly stats
    // 1. Total collected this month (across all pools)
    const activePayments = await prisma.payment.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1),
        }
      }
    });
    const totalCollected = activePayments.reduce((sum, p) => sum + p.amountPaid, 0);

    // 2. Total pots paid out
    const pots = await prisma.potAssignment.findMany({
      where: {
        assignedAt: {
          gte: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1),
        }
      }
    });
    const totalPotsPaid = pots.reduce((sum, p) => sum + (p.potAmount || 0), 0);

    // 3. Outstanding (Simplified: just look at enrollments in active pools for currentMonth)
    const pools = await prisma.pool.findMany({ where: { status: 'ACTIVE' }, include: { scheme: true, enrollments: { include: { payments: true } } } });
    let totalUnpaid = 0;
    const memberConsistency = new Map<string, number>();

    for (const pool of pools) {
      const schedule = typeof pool.scheme.paymentSchedule === 'string' ? JSON.parse(pool.scheme.paymentSchedule) : pool.scheme.paymentSchedule;
      const currentDue = schedule.find((s: any) => s.month === pool.currentMonth)?.amountDue || 0;
      
      for (const enr of pool.enrollments) {
        const hasPaid = enr.payments.some(p => p.month === pool.currentMonth);
        if (!hasPaid) totalUnpaid += currentDue;

        // Tracks total successful payments ever for "performers"
        const paidCount = enr.payments.filter(p => p.status === 'PAID').length;
        // Simplified member name lookup for ranking
        // Note: we'd need member info here.
      }
    }

    // Get top 3 performers (most consistent members)
    const topMembers = await prisma.member.findMany({
      take: 3,
      orderBy: { enrollments: { _count: 'desc' } } // Placeholder rank: whoever is in most pools
    });
    const topPerformers = topMembers.map(m => m.fullName);

    const monthData = {
      totalCollected,
      totalPotsPaid,
      totalUnpaid,
      topPerformers
    };

    const summaryMessage = await generateMonthlySummary(monthData);
    if (summaryMessage) {
      await sendWhatsAppMessage(settings.ownerPhone, summaryMessage);
      console.log('Monthly summary sent to owner.');
    }
  } catch (error) {
    console.error('Error in monthly summary scheduler:', error);
  }
};

export const initScheduler = async () => {
  await runDailyReminders(); // wire up daily cron immediately

  // Monthly Business Summary: 28th at 8:00 PM (unchanged)
  cron.schedule('0 20 28 * *', () => {
    console.log('Running scheduled Monthly Business Summary...');
    sendMonthlyBusinessSummary();
  });

  console.log('Daily reminder scheduler active — runs every day at 08:00 AM.');
  console.log('Monthly Business Summary scheduler set to run on the 28th at 8:00 PM.');
};

/**
 * Schedules a single cron job that runs every day at 08:00 AM.
 * Each morning it:
 *   1. Checks ScheduledReminder table for entries where dayOfMonth = today
 *   2. Sends reminders scoped to the reminder's target (pool / all_pools / member)
 *   3. Also honours the legacy AppSettings.autoReminders flag on settings.reminderDay
 */
const runDailyReminders = () => {
  cron.schedule('0 8 * * *', async () => {
    const today = new Date().getDate();
    console.log(`[Scheduler] Daily check — day ${today}`);

    try {
      // ── Legacy: AppSettings-based reminder ──────────────────────────────────
      const settings = await prisma.appSettings.findFirst();
      if (settings?.autoReminders && settings.reminderDay === today) {
        console.log('[Scheduler] Sending legacy AppSettings payment reminders...');
        await sendPaymentReminders();
      }

      // ── Dynamic: ScheduledReminder table ─────────────────────────────────────
      const activeReminders = await (prisma as any).scheduledReminder.findMany({
        where: { dayOfMonth: today, isActive: true },
      });

      if (activeReminders.length === 0) return;

      console.log(`[Scheduler] Found ${activeReminders.length} dynamic reminder(s) for day ${today}`);

      for (const reminder of activeReminders) {
        await sendDynamicReminder(reminder, settings);
      }
    } catch (err) {
      console.error('[Scheduler] Error in daily reminder job:', err);
    }
  });
};

/** Send a single dynamic reminder scoped by targetType */
const sendDynamicReminder = async (reminder: any, settings: any) => {
  const companyName = settings?.companyName || 'ChitFund Pro';

  if (reminder.targetType === 'all_pools' || !reminder.targetId) {
    // Send to all unpaid members across all pools
    await sendPaymentReminders();
    return;
  }

  if (reminder.targetType === 'pool') {
    // Send reminders only for a specific pool
    await sendPaymentRemindersForPool(reminder.targetId, companyName, reminder.messageOverride);
    return;
  }

  if (reminder.targetType === 'member') {
    // Send reminder to a single member
    await sendReminderToMember(reminder.targetId, companyName, reminder.messageOverride);
  }
};

/** Send payment reminders scoped to a single pool */
const sendPaymentRemindersForPool = async (poolId: string, companyName: string, messageOverride?: string | null) => {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      scheme: true,
      enrollments: { include: { member: true, payments: true } },
    },
  });
  if (!pool || pool.status !== 'ACTIVE') return;

  const schedule = typeof pool.scheme.paymentSchedule === 'string'
    ? JSON.parse(pool.scheme.paymentSchedule)
    : pool.scheme.paymentSchedule;
  const currentDue = (schedule as any[]).find((s: any) => s.month === pool.currentMonth);
  if (!currentDue) return;

  for (const enr of pool.enrollments) {
    const hasPaid = enr.payments.some(p => p.month === pool.currentMonth);
    if (hasPaid) continue;

    const message = messageOverride
      || `Hello ${enr.member.fullName} 👋\n\nReminder: Your payment for ${pool.name} (Month ${pool.currentMonth}) of ₹${currentDue.amountDue.toLocaleString()} is due.\n\nThank you,\n${companyName}`;

    const result = await sendWhatsAppMessage(enr.member.phone, message);
    await prisma.notificationLog.create({
      data: {
        memberName: enr.member.fullName,
        phone: enr.member.phone,
        messageContent: message,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error || null,
      },
    });
  }
};

/** Send a reminder to a single member for all their unpaid dues */
const sendReminderToMember = async (memberId: string, companyName: string, messageOverride?: string | null) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      enrollments: {
        include: {
          pool: { include: { scheme: true } },
          payments: true,
        },
      },
    },
  });
  if (!member) return;

  const dues: string[] = [];
  for (const enr of member.enrollments) {
    const pool = enr.pool;
    if (pool.status !== 'ACTIVE') continue;
    const hasPaid = enr.payments.some(p => p.month === pool.currentMonth);
    if (!hasPaid) {
      const schedule = typeof pool.scheme.paymentSchedule === 'string'
        ? JSON.parse(pool.scheme.paymentSchedule)
        : pool.scheme.paymentSchedule;
      const due = (schedule as any[]).find((s: any) => s.month === pool.currentMonth);
      dues.push(`${pool.name} — ₹${(due?.amountDue || 0).toLocaleString()} (Month ${pool.currentMonth})`);
    }
  }

  if (dues.length === 0) return;

  const message = messageOverride
    || `Hello ${member.fullName} 👋\n\nPayment reminder:\n${dues.join('\n')}\n\nThank you,\n${companyName}`;

  const result = await sendWhatsAppMessage(member.phone, message);
  await prisma.notificationLog.create({
    data: {
      memberName: member.fullName,
      phone: member.phone,
      messageContent: message,
      status: result.success ? 'SENT' : 'FAILED',
      errorMessage: result.error || null,
    },
  });
};

/** @deprecated Use initScheduler. Kept for backward compatibility if called from settings route. */
export const rescheduleReminder = (dayOfMonth: number) => {
  console.log(`[Scheduler] rescheduleReminder called for day ${dayOfMonth} — now handled dynamically via ScheduledReminder table.`);
};

