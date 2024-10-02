import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error in GET /api/chats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('POST /api/chats: No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('POST /api/chats: Authenticated user', user.id);

    const { forceNew } = await req.json();

    // Check for existing chat
    const existingChat = await prisma.chat.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingChat && !forceNew) {
      console.log('POST /api/chats: Returning existing chat', existingChat.id);
      return NextResponse.json(existingChat);
    }

    // If no existing chat or forceNew is true, create a new chat
    if (!existingChat || forceNew) {
      console.log('POST /api/chats: Creating new chat for user', user.id);
      const newChat = await prisma.chat.create({
        data: { userId: user.id },
      });

      console.log('POST /api/chats: New chat created', newChat.id);
      return NextResponse.json(newChat);
    }

    // This line should never be reached, but TypeScript likes it
    return NextResponse.json({ error: 'Unexpected state' }, { status: 500 });

  } catch (error: unknown) {
    console.error('Error in POST /api/chats:', error);
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error details:', error.stack);
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      console.error('Unexpected error type:', typeof error);
    }
    
    return NextResponse.json({ error: 'Failed to create chat', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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

    return NextResponse.json({ deletedCount: deletedChats.count });
  } catch (error) {
    console.error('Error deleting empty chats:', error);
    return NextResponse.json({ error: 'Failed to delete empty chats' }, { status: 500 });
  }
}