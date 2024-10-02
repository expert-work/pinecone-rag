import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    return NextResponse.json({ 
      success: true, 
      result: (result as { test: number }[])[0].test.toString() 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}