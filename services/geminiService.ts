import { GoogleGenAI, Type, Schema } from "@google/genai";

const apiKey = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const generateInvoiceDetails = async (rawInput: string) => {
  if (!ai) {
    console.warn("Gemini API Key not found. Mocking response.");
    return {
        description: `Processed: ${rawInput}`,
        suggestedAmount: "10.0"
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an invoicing assistant. Extract a professional invoice description and a suggested amount (if mentioned, otherwise 0) from this raw input: "${rawInput}". The currency is gUSDT (Stable).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Professional line item description" },
            suggestedAmount: { type: Type.STRING, description: "Numeric string of amount found, or '0'" }
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini Error:", error);
    return { description: rawInput, suggestedAmount: "0" };
  }
};
