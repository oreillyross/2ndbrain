export type Summariser = {
  model: string;
  summarise(text: string): Promise<string>;
};

export const SYNOPSIS_MODEL = "gpt-4.1-mini";

const SYSTEM_PROMPT = `You are an expert thinking assistant.
Summarise the key ideas, themes, and insights from a collection of notes.
Be concise but insightful.`;

/** OpenAI Responses API via fetch (one subrequest). */
export function openAiSummariser(apiKey: string | undefined, fetchFn: typeof fetch = fetch): Summariser {
  return {
    model: SYNOPSIS_MODEL,
    async summarise(text) {
      if (!apiKey) throw new Error("OPENAI_API_KEY unset");
      const res = await fetchFn("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: SYNOPSIS_MODEL,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const json = (await res.json()) as {
        output_text?: string;
        output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      };
      const text_ =
        json.output_text ??
        json.output
          ?.filter((o) => o.type === "message")
          .flatMap((o) => o.content ?? [])
          .find((c) => c.type === "output_text")?.text;
      if (!text_) throw new Error("OpenAI returned no text");
      return text_;
    },
  };
}
