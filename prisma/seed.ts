import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS Chat (
      id TEXT PRIMARY KEY,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS Message (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      role TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      chatId TEXT NOT NULL,
      FOREIGN KEY (chatId) REFERENCES Chat(id)
    );
  `

  console.log('Tables created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })