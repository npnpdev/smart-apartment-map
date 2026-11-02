import pl from './pl.json';

export const t = pl;

export function translateApiError(message: string): string {
  return (t.apiErrors as Record<string, string>)[message] ?? message;
}
