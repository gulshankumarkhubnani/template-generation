import * as vscode from 'vscode';

interface LLMMessage {
  role: 'system' | 'user';
  content: string;
}

async function callLLM(messages: LLMMessage[]): Promise<string> {
  const config = vscode.workspace.getConfiguration('crudGenerator');
  const endpoint = config.get<string>('llmEndpoint')?.trim() || '';
  // const apiKey = config.get<string>('llmApiKey')?.trim() || '';
  const apiKey ="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",
          

  if (!endpoint || !apiKey) {
    throw new Error('LLM endpoint or API key not configured. Please set "crudGenerator.llmEndpoint" and "crudGenerator.llmApiKey" in settings.');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this environment.');
  }

  const model = config.get<string>('llmModel')?.trim() || 'gpt-3.5-turbo';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  const data:any = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

export async function generateCrudFromLLM(
  framework: string,
  entity: string,
  fields: string
): Promise<string> {
  const systemPrompt = `
You are a backend developer. Generate a complete Git repo structure for a ${framework} CRUD service.
- Entity: ${entity}
- Fields: ${fields}

Return output as a JSON object where each key is a relative file path and each value is the full file content.
Example:
{
  "README.md": "...",
  "src/index.js": "..."
}

Only output valid JSON, no markdown fences.
`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Generate a full ${framework} CRUD repository for ${entity} with fields: ${fields}. Include required config files, model, controller, and README.`,
    },
  ];

  try {
    return await callLLM(messages);
  } catch (err: any) {
    vscode.window.showErrorMessage(`LLM error: ${err.message}`);
    return '';
  }
}
