import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'prasanthselvaads@gmail.com';
  const password = await bcrypt.hash('75300@Prx', 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password,
    },
  });

  const generateSchemeData = (multiplier: number, name: string) => {
    const payments = [
      5000, 
      ...Array(7).fill(3750), // M2-M8
      3850, 3950, 4050, 4150, 4250, 4350, 4500, 4600, 4700, 4800, 4900, 5000 // M9-M20
    ];
    
    const payouts = [
      ...Array(8).fill(70000), // M1-M8
      72000, 74000, 76000, 78000, 80000, 82000, 84000, 86000, 88000, 90000, // M9-M18
      90000, 90000 // M19-M20? Just keeping it up to 90k based on prompt
    ];

    const paymentSchedule = payments.map((amt, idx) => ({ month: idx + 1, amountDue: amt * multiplier }));
    const payoutSchedule = payouts.map((amt, idx) => ({ month: idx + 1, potAmount: amt * multiplier }));

    return {
      name,
      poolAmount: 100000 * multiplier,
      numberOfMembers: 20,
      numberOfMonths: 20,
      paymentSchedule: JSON.stringify(paymentSchedule),
      payoutSchedule: JSON.stringify(payoutSchedule),
    };
  };

  const schemesToCreate = [
    generateSchemeData(1, "₹1 Lakh Scheme"),
    generateSchemeData(2, "₹2 Lakh Scheme"),
    generateSchemeData(5, "₹5 Lakh Scheme"),
  ];

  for (const schemeData of schemesToCreate) {
    const existing = await prisma.scheme.findFirst({ where: { name: schemeData.name } });
    if (!existing) {
      await prisma.scheme.create({ data: schemeData });
    }
  }

  console.log('Seed: Admin user and Schemes ensured.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
