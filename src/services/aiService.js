import { getAiModel } from '../firebase/ai';

export const generateAiText = async (prompt, options = {}) => {
  const trimmedPrompt = String(prompt ?? '').trim();

  if (!trimmedPrompt) {
    throw new Error('Enter a prompt before generating AI content.');
  }

  const model = getAiModel(options.model);
  const result = await model.generateContent(trimmedPrompt);
  return result.response.text();
};
