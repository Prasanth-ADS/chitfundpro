import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'prasanthselvaads@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log('User not found!');
    return;
  }

  const password = '75300@Prx';
  const isValid = await bcrypt.compare(password, user.password);
  
  console.log('--- User Verification ---');
  console.log(`Email: ${user.email}`);
  console.log(`Hash: ${user.password}`);
  console.log(`Password Match ('${password}'): ${isValid}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
