const signatures: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

export function hasExpectedFileSignature(content: Buffer, contentType: string): boolean {
  const signature = signatures[contentType];
  if (!signature || content.length < signature.length) return false;
  if (!signature.every((byte, index) => content[index] === byte)) return false;
  return contentType !== 'image/webp' || content.length >= 12
    && content.subarray(8, 12).toString('ascii') === 'WEBP';
}
