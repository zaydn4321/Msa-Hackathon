import Anthropic from "@anthropic-ai/sdk";

let _instance: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY must be set to generate clinical briefs.",
    );
  }
  if (!_instance) {
    _instance = new Anthropic({ apiKey });
  }
  return _instance;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
