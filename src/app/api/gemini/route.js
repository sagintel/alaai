import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function POST(req) {
  try {
    const { history, message, context } = await req.json();
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const formattedHistory = history.map(item => ({
      role: item.role,
      parts: [{ text: item.parts }]
    }));

    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error in /api/gemini:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}
