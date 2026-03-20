import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const models = [
    { name: 'User', property: 'user' },
    { name: 'Scheme', property: 'scheme' },
    { name: 'Pool', property: 'pool' },
    { name: 'Member', property: 'member' },
    { name: 'Enrollment', property: 'enrollment' },
    { name: 'Payment', property: 'payment' },
    { name: 'PotAssignment', property: 'potAssignment' },
    { name: 'AppSettings', property: 'appSettings' },
    { name: 'NotificationLog', property: 'notificationLog' },
    { name: 'ScheduledReminder', property: 'scheduledReminder' }
  ];

  console.log('--- Database Verification ---');
  for (const model of models) {
    try {
      // @ts-ignore
      const count = await prisma[model.property].count();
      console.log(`[CHECK] ${model.name}: ${count} records`);
    } catch (e: any) {
      console.log(`[ERROR] ${model.name}: ${e.message}`);
    }
  }

  // Specific check for Schemes
  const schemes = await prisma.scheme.findMany();
  console.log('\n--- Scheme Details ---');
  for (const s of schemes) {
    console.log(`- ${s.name}: paymentSchedule length=${s.paymentSchedule.length}, payoutSchedule length=${s.payoutSchedule.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
