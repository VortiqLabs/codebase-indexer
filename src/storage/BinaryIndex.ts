import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { decode, encode } from '@msgpack/msgpack';
import {
  INDEX_CHECKSUM_SIZE,
  INDEX_FORMAT_VERSION,
  INDEX_HEADER_SIZE,
  INDEX_MAGIC,
  type IndexSnapshot
} from './IndexFormat.js';

export class IndexFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IndexFormatError';
  }
}

export class IndexWriter {
  static async writeAtomic(filePath: string, snapshot: IndexSnapshot): Promise<void> {
    const uid = Buffer.from(snapshot.metadata.uid, 'utf8');
    if (uid.length > 0xffff) throw new Error('Index UID is too long');
    const payload = Buffer.from(encode(snapshot));
    const header = Buffer.alloc(INDEX_HEADER_SIZE);
    INDEX_MAGIC.copy(header, 0);
    header.writeUInt16BE(INDEX_FORMAT_VERSION, 8);
    header.writeUInt16BE(0, 10);
    header.writeUInt16BE(uid.length, 12);
    header.writeBigUInt64BE(BigInt(payload.length), 14);
    const body = Buffer.concat([header, uid, payload]);
    const checksum = createHash('sha256').update(body).digest();
    const temporaryPath = `${filePath}.tmp`;

    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      const handle = await open(temporaryPath, 'w');
      try {
        await handle.writeFile(Buffer.concat([body, checksum]));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

export class IndexReader {
  static async read(filePath: string, expectedUid?: string): Promise<IndexSnapshot> {
    const buffer = await readFile(filePath);
    if (buffer.length < INDEX_HEADER_SIZE + INDEX_CHECKSUM_SIZE) {
      throw new IndexFormatError('Index is truncated');
    }
    if (!buffer.subarray(0, INDEX_MAGIC.length).equals(INDEX_MAGIC)) {
      throw new IndexFormatError('Invalid index magic bytes');
    }
    const version = buffer.readUInt16BE(8);
    if (version !== INDEX_FORMAT_VERSION) {
      throw new IndexFormatError(`Unsupported index format version: ${version}`);
    }
    const uidLength = buffer.readUInt16BE(12);
    const payloadLength = buffer.readBigUInt64BE(14);
    const bodyLength = INDEX_HEADER_SIZE + uidLength + Number(payloadLength);
    if (!Number.isSafeInteger(Number(payloadLength)) || bodyLength + INDEX_CHECKSUM_SIZE !== buffer.length) {
      throw new IndexFormatError('Invalid index section lengths');
    }
    const expectedChecksum = buffer.subarray(bodyLength);
    const actualChecksum = createHash('sha256').update(buffer.subarray(0, bodyLength)).digest();
    if (!timingSafeEqual(expectedChecksum, actualChecksum)) {
      throw new IndexFormatError('Index checksum validation failed');
    }
    const uid = buffer.toString('utf8', INDEX_HEADER_SIZE, INDEX_HEADER_SIZE + uidLength);
    if (expectedUid !== undefined && uid !== expectedUid) {
      throw new IndexFormatError(`Index UID mismatch: expected ${expectedUid}, found ${uid}`);
    }
    let value: unknown;
    try {
      value = decode(buffer.subarray(INDEX_HEADER_SIZE + uidLength, bodyLength));
    } catch {
      throw new IndexFormatError('Index payload could not be decoded');
    }
    if (!isIndexSnapshot(value) || value.metadata.uid !== uid) {
      throw new IndexFormatError('Index payload does not match its header');
    }
    return value;
  }
}

function isIndexSnapshot(value: unknown): value is IndexSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Partial<IndexSnapshot>;
  return typeof snapshot.metadata === 'object' && snapshot.metadata !== null &&
    typeof snapshot.metadata.uid === 'string' && Array.isArray(snapshot.files) &&
    Array.isArray(snapshot.symbols) && Array.isArray(snapshot.relations) &&
    Array.isArray(snapshot.chunks) && Array.isArray(snapshot.vectors);
}