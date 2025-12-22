import { prisma } from "../lib/db";

async function main() {
  const year = 2026;

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  let count = 0;

  for (
    let d = new Date(start);
    d < end;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    await prisma.dayEntry.upsert({
      where: { date: d },
      update: {},
      create: { date: d },
    });
    count++;
  }

  console.log(`Seeded ${count} days for ${year}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

