import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "../../src/config.js";
import { deleteStoredFile, readStoredFile, resolveKey, saveUpload, sniff, validateUpload } from "../../src/lib/storage.js";

const file = (originalname, mimetype, buffer) => ({ originalname, mimetype, size: buffer.length, buffer });
const PDF = Buffer.from("%PDF-1.4\n% test document\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("test-image-bytes")]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

describe("upload storage", () => {
  it("stores files under the test UPLOAD_DIR, never in public/ or client/", () => {
    expect(config.uploadDir).toContain("fashinza-server-unit-uploads");
  });

  it("sniffs PDF, PNG, JPEG and WebP signatures", () => {
    expect(sniff(PDF)).toBe("application/pdf");
    expect(sniff(PNG)).toBe("image/png");
    expect(sniff(JPG)).toBe("image/jpeg");
    expect(sniff(WEBP)).toBe("image/webp");
    expect(sniff(Buffer.from("hello"))).toBeNull();
  });

  it("validates presence, size and type with today's messages", () => {
    expect(() => validateUpload(undefined)).toThrow("Choose a file to upload.");
    expect(() => validateUpload(file("a.pdf", "application/pdf", Buffer.alloc(0)))).toThrow("Choose a file to upload.");
    expect(() => validateUpload({ ...file("a.pdf", "application/pdf", PDF), size: 10 * 1024 * 1024 + 1 })).toThrow("Files must be 10 MB or smaller.");
    expect(() => validateUpload(file("a.gif", "image/gif", PNG))).toThrow("Upload a PDF, PNG, JPEG or WebP file.");
    expect(() => validateUpload(file("a.pdf", "application/pdf", PDF), { imagesOnly: true })).toThrow("Upload PNG, JPEG or WebP images.");
    try {
      validateUpload(undefined);
    } catch (e) {
      expect(e.code).toBe("INVALID");
    }
  });

  it("rejects files whose content does not match the declared type", async () => {
    await expect(saveUpload(file("fake.pdf", "application/pdf", PNG), "projects")).rejects.toThrow(
      "The file content does not match its type. Upload a genuine PDF or image.",
    );
  });

  it("saves under a random key, sanitises the name, reads back and deletes", async () => {
    const stored = await saveUpload(file("../../etc/tech pack (v2) — final?.pdf", "application/pdf", PDF), "projects");
    expect(stored.fileKey).toMatch(/^projects\/[a-f0-9]{32}\.pdf$/);
    expect(stored.fileName).toBe("tech pack (v2) _ final_.pdf");
    expect(stored).toMatchObject({ mimeType: "application/pdf", size: PDF.length });
    const full = path.join(config.uploadDir, stored.fileKey);
    expect(fs.existsSync(full)).toBe(true);
    expect((await readStoredFile(stored.fileKey)).equals(PDF)).toBe(true);
    await deleteStoredFile(stored.fileKey);
    expect(fs.existsSync(full)).toBe(false);
    await deleteStoredFile(stored.fileKey); // already gone: no error
  });

  it("falls back to file.<ext> when the name is empty", async () => {
    const stored = await saveUpload(file("", "image/png", PNG), "samples", { imagesOnly: true });
    expect(stored.fileName).toBe("file.png");
    await deleteStoredFile(stored.fileKey);
  });

  it("refuses malformed keys (no path traversal)", () => {
    for (const key of ["../secret.pdf", "projects/../../x.pdf", "projects/abc.pdf", "Projects/" + "a".repeat(32) + ".pdf", "projects/" + "a".repeat(32) + ".exe"]) {
      expect(() => resolveKey(key), key).toThrow("Invalid file key.");
    }
    expect(resolveKey("factory-docs/" + "a".repeat(32) + ".pdf")).toBe(path.join(config.uploadDir, "factory-docs", "a".repeat(32) + ".pdf"));
  });
});
