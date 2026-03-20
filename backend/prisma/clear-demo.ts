import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data cleanup...');
  
  // Clear operational and transactional data
  const logs = await prisma.notificationLog.deleteMany();
  console.log(`Deleted ${logs.count} notification logs.`);
  
  const payments = await prisma.payment.deleteMany();
  console.log(`Deleted ${payments.count} payments.`);
  
  const potAssignments = await prisma.potAssignment.deleteMany();
  console.log(`Deleted ${potAssignments.count} pot assignments.`);
  
  const enrollments = await prisma.enrollment.deleteMany();
  console.log(`Deleted ${enrollments.count} enrollments.`);
  
  const members = await prisma.member.deleteMany();
  console.log(`Deleted ${members.count} members.`);

  console.log('Data cleanup process completed. Schemes, Pools, and AppSettings remain intact.');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
