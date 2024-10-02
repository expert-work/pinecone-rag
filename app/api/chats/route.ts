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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { forceNew } = await req.json();

    if (!forceNew) {
      const existingChat = await prisma.chat.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (existingChat) {
        return NextResponse.json(existingChat);
      }
    }

    const newChat = await prisma.chat.create({
      data: { userId: user.id },
    });

    return NextResponse.json(newChat);
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
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