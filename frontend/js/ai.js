// ============================================================
//  Flora — AI Engine
//  Provider: OpenRouter (openrouter.ai)
//  Key and model stored in the user's own localStorage.
// ============================================================

const AI_KEY_STORAGE    = "flora-ai-key";
const AI_MODEL_STORAGE  = "flora-ai-model";
const OPENROUTER_URL    = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";
const FALLBACK_MODEL    = "meta-llama/llama-3.3-70b-instruct:free";

window.getAiKey = function() {
    return localStorage.getItem(AI_KEY_STORAGE) || "";
}

window.setAiKey = function(key) {
    localStorage.setItem(AI_KEY_STORAGE, key.trim());
}

window.getAiModel = function() {
    return localStorage.getItem(AI_MODEL_STORAGE) || FALLBACK_MODEL;
}

window.setAiModel = function(model) {
    localStorage.setItem(AI_MODEL_STORAGE, model.trim());
}

window.hasAiKey = function() {
    return window.getAiKey().length > 10;
}

// Fetch currently available free models from OpenRouter
window.fetchFreeModels = async function(apiKey) {
    const response = await fetch(OPENROUTER_URL.replace("/chat/completions", "/models"), {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin || "http://localhost:5500",
            "X-Title": "Flora Study Platform"
        }
    });

    if (!response.ok) throw new Error("Could not fetch models. Check your API key.");

    const data = await response.json();
    const models = (data.data || []).filter(model => {
        const pricing = model.pricing || {};
        const promptPrice = parseFloat(pricing.prompt || "1");
        const completionPrice = parseFloat(pricing.completion || "1");
        return (promptPrice === 0 && completionPrice === 0) ||
               model.id.endsWith(":free");
    });

    return models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
}

window.askGemini = async function(prompt) {
    const apiKey = getAiKey();
    if (!apiKey) {
        throw new Error("No API key configured. Open AI Settings to add your OpenRouter key.");
    }

    const model = getAiModel();
    if (!model) {
        throw new Error("No AI model selected. Open AI Settings and click 'Load Free Models' to choose one.");
    }

    const body = {
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2048
    };

    let response;
    try {
        response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": window.location.origin || "http://localhost:5500",
                "X-Title": "Flora Study Platform"
            },
            body: JSON.stringify(body)
        });
    } catch (networkError) {
        console.error("Flora AI fetch error:", networkError);
        throw new Error(
            "Network error: " + networkError.message +
            ". This is usually caused by an ad-blocker or no internet. " +
            "Try disabling browser extensions or check the console (F12)."
        );
    }

    if (!response.ok) {
        let message = `API error ${response.status}`;
        try {
            const errorData = await response.json();
            message = errorData?.error?.message || message;
        } catch (_) {}

        if (response.status === 429) {
            message = "Rate limit reached. Please wait a moment and try again.";
        } else if (response.status === 401 || response.status === 403) {
            message = "Invalid API key. Please check your AI Settings.";
        } else if (response.status === 402) {
            message = "No credits. Use a free model from AI Settings.";
        } else if (response.status === 404 || message.toLowerCase().includes("unavailable")) {
            message = `Model "${model}" is not available. Open AI Settings, click 'Load Free Models', and choose a different one.`;
        }

        throw new Error(message);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
        throw new Error("The AI returned an empty response. Try again with more content in your note.");
    }

    return text.trim();
}

window.buildSummarizePrompt = function(noteContent) {
    return `You are a study assistant. Summarize the following study notes into clear, concise bullet points that a student can use for quick revision. Keep the language simple.

---
${noteContent}
---

Respond with a clean summary using bullet points. Do not include any preamble.`;
}

window.buildExplainPrompt = function(noteContent) {
    return `You are a patient study tutor. Explain the following study material in simple terms as if you are teaching a student who is seeing this for the first time. Use analogies where helpful.

---
${noteContent}
---

Respond with a clear explanation. Use short paragraphs. Do not include any preamble.`;
}

window.buildFlashcardsPrompt = function(noteContent) {
    return `You are a study assistant. Read the following notes and generate exactly 5 flashcards for active recall practice.

---
${noteContent}
---

Respond ONLY with a valid JSON array. Each object must have "front" (the question) and "back" (the answer). Example:
[
  {"front": "What is photosynthesis?", "back": "The process by which plants convert sunlight into energy."}
]

Do not include any text before or after the JSON array. Do not use markdown code fences.`;
}

window.buildQuizPrompt = function(noteContent) {
    return `You are a study assistant. Read the following notes and generate exactly 5 multiple-choice quiz questions.

---
${noteContent}
---

Respond ONLY with a valid JSON array. Each object must have "prompt" (the question), "options" (exactly 4 strings), and "correctIndex" (0-3).

Example:
[
  {
    "prompt": "What is the powerhouse of the cell?",
    "options": ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"],
    "correctIndex": 2
  }
]

Do not include any text before or after the JSON array. Do not use markdown code fences.`;
}

window.parseJsonFromAi = function(text) {
    let cleaned = text.trim();

    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
        for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
        throw new Error("No array found in response.");
    } catch (e) {
        throw new Error("Could not parse AI response as JSON. Try again — the model may have added extra text.");
    }
}