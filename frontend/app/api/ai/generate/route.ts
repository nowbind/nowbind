import { OpenAI } from "openai";

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    })
  : null;

const AI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/api/generate";

export async function POST(req: Request) {
  try {
    const { prompt, option, context, tone } = await req.json();

    let systemPrompt = "You are an AI writing assistant integrated into NowBind. ";
    
    switch (option) {
      case "continue":
        systemPrompt += `Continue the text naturally. Maintain the current tone and style. If a sentence is incomplete, finish it first. Current tone: ${tone || "balanced"}.`;
        break;
      case "improve":
        systemPrompt += "Improve the following text for clarity, engagement, and flow. Fix any grammar or spelling issues.";
        break;
      case "rewrite":
        systemPrompt += `Rewrite the following text to be ${tone || "more engaging"}. Keep the core meaning but improve the phrasing.`;
        break;
      case "summarize":
        systemPrompt += "Provide a concise summary of the following text.";
        break;
      case "fix-grammar":
        systemPrompt += "Fix only the grammar and spelling mistakes. Do not change the wording unless it is grammatically incorrect.";
        break;
      case "headline":
        systemPrompt += "Generate a few strong, catchy headlines based on the provided text.";
        break;
      case "shorten":
        systemPrompt += "Make the following text more concise without losing its main points.";
        break;
      case "lengthen":
        systemPrompt += "Expand on the following text with relevant details and more descriptive language.";
        break;
      default:
        systemPrompt += "Help the user with their writing.";
    }

    // Try OpenAI first
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        });

        return new Response(JSON.stringify({ text: response.choices[0].message.content }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.warn("OpenAI failed, falling back to Ollama:", err);
      }
    }

    // Fallback to Ollama
    try {
      const ollamaRes = await fetch(OLLAMA_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama2",
          prompt: `${systemPrompt}\n\nInput Text: ${prompt}\n\nContext: ${context || ""}`,
          stream: false,
        }),
      });

      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        return new Response(JSON.stringify({ text: data.response }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      console.error("Ollama fallback failed:", err);
    }

    // Graceful failure
    return new Response(
      JSON.stringify({ 
        text: "I'm currently unable to process AI requests. Please check your AI configuration or try again later.",
        error: true 
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    console.error("AI route error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
