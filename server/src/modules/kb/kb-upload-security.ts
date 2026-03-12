import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export type SupportedKbFileKind = 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx';

type SupportedKbFileDescriptor = {
  extension: `.${SupportedKbFileKind}`;
  mimeType: string;
};

const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

const KB_FILE_TYPES: Record<SupportedKbFileKind, SupportedKbFileDescriptor> = {
  pdf: {
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  doc: {
    extension: '.doc',
    mimeType: 'application/msword',
  },
  docx: {
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  ppt: {
    extension: '.ppt',
    mimeType: 'application/vnd.ms-powerpoint',
  },
  pptx: {
    extension: '.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
};

function startsWithSignature(buffer: Buffer, signatures: Buffer[]): boolean {
  return signatures.some((signature) => buffer.subarray(0, signature.length).equals(signature));
}

function includesAsciiToken(buffer: Buffer, token: string): boolean {
  return buffer.indexOf(Buffer.from(token, 'utf8')) !== -1;
}

function sanitizeStem(rawName: string): string {
  return (
    rawName
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 80) || 'document'
  );
}

export function detectKbFileKind(buffer: Buffer): SupportedKbFileKind | null {
  if (!buffer?.length) return null;

  if (buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return 'pdf';
  }

  if (startsWithSignature(buffer, [OLE_SIGNATURE])) {
    if (includesAsciiToken(buffer, 'WordDocument')) return 'doc';
    if (includesAsciiToken(buffer, 'PowerPoint Document')) return 'ppt';
    return null;
  }

  if (startsWithSignature(buffer, ZIP_SIGNATURES)) {
    if (includesAsciiToken(buffer, 'word/')) return 'docx';
    if (includesAsciiToken(buffer, 'ppt/')) return 'pptx';
    return null;
  }

  return null;
}

export function normalizeKbUpload(file: Pick<Express.Multer.File, 'originalname' | 'buffer'>) {
  const kind = detectKbFileKind(file.buffer);
  if (!kind) {
    throw new BadRequestException(
      'Unsupported or unrecognized file signature. Only PDF, DOC, DOCX, PPT, and PPTX files are accepted.',
    );
  }

  const descriptor = KB_FILE_TYPES[kind];
  const incomingExtension = path.extname(file.originalname || '').toLowerCase();
  if (incomingExtension && incomingExtension !== descriptor.extension) {
    throw new BadRequestException(
      `File contents do not match the provided extension ${incomingExtension}. Expected ${descriptor.extension}.`,
    );
  }

  const originalStem = path.basename(file.originalname || '', incomingExtension);
  const safeStem = sanitizeStem(originalStem);

  return {
    kind,
    extension: descriptor.extension,
    mimeType: descriptor.mimeType,
    fileName: `${safeStem}${descriptor.extension}`,
  };
}
