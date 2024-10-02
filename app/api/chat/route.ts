import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { openai } from '@/app/lib/openai';
import { Pinecone, RecordMetadata, Index } from '@pinecone-database/pinecone';

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? '';

type PineconeMetadata = RecordMetadata & {
  text: string;
};

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-Id');
    const { messages } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const query = messages[messages.length - 1].content;

    const pinecone = new Pinecone();
    const index = pinecone.Index<PineconeMetadata>(PINECONE_INDEX_NAME);

    let systemMessage: string;
    let relevantDocs: string[] = [];

    if (isGeneralQuery(query)) {
      systemMessage = getGeneralSystemMessage();
    } else {
      relevantDocs = await retrieveDocumentsFromPinecone(index, query);
      systemMessage = getInformedSystemMessage(relevantDocs);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        ...messages
      ],
      stream: true,
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred during your request.' }), { status: 500 });
  }
}

// Helper functions

function isGeneralQuery(query: string): boolean {
  // Implement logic to determine if the query is general or specific
  return query.length < 10; // Example: consider short queries as general
}

async function retrieveDocumentsFromPinecone(index: Index<PineconeMetadata>, query: string): Promise<string[]> {
  const queryEmbedding = await getEmbedding(query);

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  return queryResponse.matches
    .filter((match): match is (typeof match & { metadata: PineconeMetadata }) => 
      match.metadata !== undefined && typeof match.metadata.text === 'string'
    )
    .map(match => match.metadata.text);
}

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

function getGeneralSystemMessage(): string {
  return "You are a knowledgeable and helpful AI assistant. Provide accurate and relevant information to the user's queries in a natural, conversational manner. If you're unsure about something, it's okay to say so and suggest alternatives or ask for clarification.";
}

function getInformedSystemMessage(relevantDocs: string[]): string {
  if (relevantDocs.length > 0) {
    return `You are a knowledgeable AI assistant with a wide range of information at your disposal. Use your extensive knowledge to provide accurate and helpful responses. Engage in natural conversation and offer detailed explanations when appropriate. If you're unsure about something, it's okay to say so and suggest alternatives or ask for clarification. Here's some relevant information that might be helpful: ${relevantDocs.join(' ')}`;
  } else {
    return "You are a knowledgeable AI assistant. While you may not have specific information about every topic, use your general knowledge to provide helpful responses. If you're unsure about something, it's okay to say so and suggest alternatives or ask for clarification.";
  }
}