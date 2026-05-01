import { OpenAI } from "openai";
import { SYSTEM_PROMPT, PROMPTS } from "@/lib/ai-prompts";

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    })
  : null;

const AI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434/api/generate";

// Rate limiting state
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_PROMPT_SIZE = 4000;

async function checkAuth(req: Request) {
  const cookie = req.headers.get("cookie");
  if (!cookie) return false;

  const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
  try {
    const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
      headers: { cookie },
    });
    return res.ok;
  } catch (err) {
    console.error("Auth check failed:", err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || "anonymous";
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
      rateData.count = 0;
      rateData.lastReset = now;
    }

    if (rateData.count >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { 
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    rateData.count++;
    rateLimitMap.set(ip, rateData);

    // 2. Authentication
    const authenticated = await checkAuth(req);
    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized. Please sign in to use AI features." }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { prompt, option, context } = await req.json();

    // 3. Prompt Size Bounding
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_SIZE) {
      return new Response(JSON.stringify({ error: `Prompt too long. Max ${MAX_PROMPT_SIZE} characters.` }), { status: 400 });
    }

    let taskPrompt = "";
    
    switch (option) {
      case "continue":
        taskPrompt = PROMPTS.continue();
        break;
      case "improve":
        taskPrompt = PROMPTS.improve();
        break;
      case "rewrite":
        taskPrompt = PROMPTS.rewrite();
        break;
      case "summarize":
        taskPrompt = PROMPTS.summarize();
        break;
      case "fix-grammar":
        taskPrompt = PROMPTS.fix_grammar();
        break;
      case "shorten":
        taskPrompt = PROMPTS.shorten();
        break;
      default:
        taskPrompt = "Help the user with their writing task based on the provided input.";
    }

    const finalSystemPrompt = `${SYSTEM_PROMPT}\n\n${taskPrompt}`;


    // Try OpenAI first
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: "system", content: finalSystemPrompt },
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
          prompt: `${finalSystemPrompt}\n\nInput Text: ${prompt}\n\nContext: ${context || ""}`,
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
        text: "I'm currently having trouble processing your request. Please try again in a few moments.",
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
