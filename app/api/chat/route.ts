/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { openai } from '@/app/lib/openai';
import { getUser } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

 

interface PineconeMatch {
  metadata?: {
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (!PINECONE_INDEX_NAME) {
    console.error('PINECONE_INDEX_NAME is not defined in the environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  try {
    const { messages, chatId } = await req.json();
    const query = messages[messages.length - 1].content;

    let chat;
    if (chatId) {
      chat = await prisma.chat.findUnique({
        where: { id: chatId, userId: user.id },
        include: { messages: true }
      });
      if (!chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), { status: 404 });
      }
    } else {
      chat = await prisma.chat.create({
        data: {
          userId: user.id
        }
      });
    }

    await prisma.message.create({
      data: {
        role: 'user',
        content: query,
        chatId: chat.id,
      },
    });

    let systemMessage;

    if (isGeneralQuery(query)) {
      systemMessage = { role: 'system', content: getRandomGeneralSystemMessage() };
    } else {
      const pinecone = new Pinecone();
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      const relevantDocs = await retrieveDocumentsFromPinecone(index, query);

      if (relevantDocs.length === 0) {
        systemMessage = {
          role: 'system',
          content: getRandomNoInfoSystemMessage()
        };
      } else {
        systemMessage = { 
          role: 'system', 
          content: `You are a knowledgeable assistant with expertise in job markets and career information. Respond to the user's query using your knowledge, but do so in a natural, conversational manner. If you're not certain about something, it's okay to express uncertainty. Here's some relevant information to consider: ${relevantDocs.join(' ')}` 
        };
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      stream: true,
      messages: [systemMessage, ...messages],
      temperature: 0.7, // Add some randomness to the responses
    });

    const stream = OpenAIStream(response, {
      async onCompletion(completion) {
        await prisma.message.create({
          data: {
            role: 'assistant',
            content: completion,
            chatId: chat.id,
          },
        });
      },
    });

    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred during your request.' }), { status: 500 });
  }
}

function isGeneralQuery(query: string): boolean {
  const generalPatterns = [
    /^hello/i,
    /^hi/i,
    /^hey/i,
    /^greetings/i,
    /how are you/i,
    /what's up/i,
    /good (morning|afternoon|evening)/i,
  ];
  return generalPatterns.some(pattern => pattern.test(query));
}

async function retrieveDocumentsFromPinecone(index: any, query: string) {
  const queryEmbedding = await getEmbedding(query);

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  return (queryResponse.matches as PineconeMatch[])
    .filter(match => match.metadata && typeof match.metadata.text === 'string')
    .map(match => match.metadata!.text!);
}

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

// Add these new functions at the end of the file
function getRandomGeneralSystemMessage(): string {
  const messages = [
    "You are a friendly and helpful assistant. Engage in natural conversation while providing accurate information.",
    "As an AI assistant, your goal is to be helpful and informative while maintaining a casual, human-like tone.",
    "You're here to assist users with their questions. Be friendly, concise, and natural in your responses.",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function getRandomNoInfoSystemMessage(): string {
  const messages = [
    "I don't have specific information about that. Could you provide more context or ask something else?",
    "I'm not sure I have the right information to answer that. Can you rephrase or ask a different question?",
    "That's an interesting question, but I don't have enough details to give a proper answer. Could you clarify or ask something else?",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}