import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPhone() {
  const number = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
  console.log('Checking number:', number);
  
  if (!number) {
    console.log('No WhatsApp number supplied in env.');
    return;
  }
  
  const record = await prisma.phoneNumber.findFirst({
    where: { number: number },
    include: { tenant: true, receptionist: true }
  });
  
  console.log('Record found:', JSON.stringify(record, null, 2));
}

checkPhone().catch(console.error).finally(() => prisma.$disconnect());
