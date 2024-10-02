import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUser } from '@/app/lib/auth';

export async function GET() {
   
  try {
    const user = await getUser();
    if (!user) {
      console.log('User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User ID:', user.id);

    const chats = await prisma.chat.findMany({
      where: { userId: user.id },
      include: { 
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Fetched chats:', JSON.stringify(chats, null, 2));

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    return NextResponse.json({ error: 'Failed to fetch chats', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      console.log('User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { forceNew } = await request.json();

    if (!forceNew) {
      console.log('Checking for existing chats for user ID:', user.id);

      // Check if the user already has a chat
      const existingChat = await prisma.chat.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (existingChat) {
        console.log('Existing chat found:', existingChat.id);
        return NextResponse.json(existingChat);
      }
    }

    console.log('Creating new chat for user ID:', user.id);

    const newChat = await prisma.chat.create({
      data: { userId: user.id },
    });

    console.log('Created new chat:', JSON.stringify(newChat, null, 2));

    return NextResponse.json(newChat);
  } catch (error) {
    console.error('Error creating/finding chat:', error);
    return NextResponse.json(
      { error: 'Failed to create/find chat', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await getUser();
    if (!user) {
      console.log('User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deletedChats = await prisma.chat.deleteMany({
      where: {
        userId: user.id,
        messages: {
          none: {}
        }
      }
    });

    console.log(`Deleted ${deletedChats.count} empty chats for user ID:`, user.id);

    return NextResponse.json({ deletedCount: deletedChats.count });
  } catch (error) {
    console.error('Error deleting empty chats:', error);
    return NextResponse.json(
      { error: 'Failed to delete empty chats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}