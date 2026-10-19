export type GenerationKind = 'chat' | 'image' | 'video';

export type GenerationResponse = {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
};

export class ShynaApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ShynaApiError';
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `A geração não pôde ser concluída (${response.status}).`;
  } catch {
    return `A geração não pôde ser concluída (${response.status}).`;
  }
}

export async function generate(kind: GenerationKind, prompt: string, model?: string): Promise<GenerationResponse> {
  const response = await fetch('/api/pollinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, prompt, model }),
  });

  if (!response.ok) throw new ShynaApiError(await readError(response), response.status);

  if (kind === 'video') {
    const blob = await response.blob();
    if (!blob.type.startsWith('video/')) throw new ShynaApiError('A API retornou um formato de vídeo inesperado.');
    return { videoUrl: URL.createObjectURL(blob) };
  }

  return (await response.json()) as GenerationResponse;
}
