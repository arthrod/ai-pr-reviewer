export function getTokenCount(input: string): number {
  input = input.replace(/<\|endoftext\|>/g, '')
  // Approximate token count: ~4 chars per token for English text
  return Math.ceil(input.length / 4)
}
