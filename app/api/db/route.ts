import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUser } from '@/app/lib/auth';

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, data } = await req.json();

  try {
    switch (action) {
      case 'findOrCreateChat':
        const chat = await findOrCreateChat(user.id);
        return NextResponse.json(chat);
      case 'saveMessage':
        const message = await saveMessage(data, user.id);
        return NextResponse.json(message);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
  }
}

async function findOrCreateChat(userId: string) {
  // First, ensure the user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Then create the chat
  return await prisma.chat.create({ data: { userId } });
}

async function saveMessage(
  data: { role: string; content: string; chatId: string },
  userId: string
) {
  const chat = await prisma.chat.findUnique({
    where: { id: data.chatId, userId },
  });

  if (!chat) {
    throw new Error('Chat not found or unauthorized');
  }

  return await prisma.message.create({
    data: {
      role: data.role,
      content: data.content,
      chatId: data.chatId,
    },
  });
}