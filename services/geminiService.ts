import { GoogleGenAI } from "@google/genai";

// Initialize client securely
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSmartReply = async (
  conversationHistory: string,
  context: string = "Você é um assistente de suporte para uma empresa chamada Happy Diversões que aluga máquinas de arcade."
): Promise<string> => {
  try {
    const prompt = `
      ${context}
      
      Abaixo está o histórico recente da conversa com um cliente.
      Gere uma sugestão de resposta curta, profissional e amigável em Português (Brasil).
      Se o cliente estiver pedindo para falar com humano, reconheça isso.
      
      Histórico:
      ${conversationHistory}
      
      Sugestão de resposta:
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar uma sugestão no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com Gemini AI.";
  }
};