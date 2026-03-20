import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const email = 'prasanthselvaads@gmail.com';
  const password = '75300@Prx';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  console.log('Login Test:', isValid ? 'SUCCESS' : 'FAILURE');
}

test().finally(() => prisma.$disconnect());
