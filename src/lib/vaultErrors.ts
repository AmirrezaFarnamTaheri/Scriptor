export function isContentHashMismatchError(message: string): boolean {
  return message.toLowerCase().includes('content hash mismatch')
}
