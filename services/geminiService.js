let aiClientPromise;

async function getAIClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing from .env");
    }

    if (!aiClientPromise) {
        aiClientPromise = import("@google/genai").then(({ GoogleGenAI }) => {
            return new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY
            });
        });
    }

    return aiClientPromise;
}

async function generateAIResponse(prompt) {
    const ai = await getAIClient();

    const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash",
        input: prompt
    });

    return interaction.output_text;
}

module.exports = { generateAIResponse };