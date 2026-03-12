import { detectKbFileKind, normalizeKbUpload } from './kb-upload-security';

describe('kb-upload-security', () => {
  it('detects PDF signatures from file content', () => {
    const buffer = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('sample pdf body')]);

    expect(detectKbFileKind(buffer)).toBe('pdf');
  });

  it('detects DOCX zip containers from internal markers', () => {
    const buffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('word/document.xml'),
    ]);

    expect(detectKbFileKind(buffer)).toBe('docx');
  });

  it('rejects mismatched extensions', () => {
    const file = {
      originalname: 'report.pdf',
      buffer: Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('word/document.xml'),
      ]),
    } as Express.Multer.File;

    expect(() => normalizeKbUpload(file)).toThrow(
      'File contents do not match the provided extension .pdf. Expected .docx.',
    );
  });
});
