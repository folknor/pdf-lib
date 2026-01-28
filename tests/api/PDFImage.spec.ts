import fs from 'fs';
import { PDFDocument, PDFImage } from '../../src/api';
import { PngEmbedder } from '../../src/core';
import { toUint8Array } from '../../src/utils';

const examplePngImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TxaoVBzuIdMhQnSyIijhKFYtgobQVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi5uak6CIl/i8ptIjx4Lgf7+497t4BQqPCVLNrAlA1y0jFY2I2tyr2vKIfAgLoRVhipp5IL2bgOb7u4ePrXZRneZ/7cwwoeZMBPpF4jumGRbxBPLNp6Zz3iUOsJCnE58TjBl2Q+JHrsstvnIsOCzwzZGRS88QhYrHYwXIHs5KhEk8TRxRVo3wh67LCeYuzWqmx1j35C4N5bSXNdZphxLGEBJIQIaOGMiqwEKVVI8VEivZjHv4Rx58kl0yuMhg5FlCFCsnxg//B727NwtSkmxSMAd0vtv0xCvTsAs26bX8f23bzBPA/A1da219tALOfpNfbWuQIGNwGLq7bmrwHXO4Aw0+6ZEiO5KcpFArA+xl9Uw4YugX61tzeWvs4fQAy1NXyDXBwCIwVKXvd492Bzt7+PdPq7wcdn3KFLu4iBAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAlFJREFUeNrt289r02AYB/Dvk6Sl4EDKpllTlFKsnUdBHXgUBEHwqHj2IJ72B0zwKHhxJ08i/gDxX/AiRfSkBxELXTcVxTa2s2xTsHNN8ngQbQL70RZqG/Z9b29JnvflkydP37whghG3ZaegoxzfwB5vBCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgwB5rstWPtnP0LqBX/vZNyLF6vVrpN/hucewhb4g+B2AyAwiwY7NGOXijviS9vBeYh6CEP4edBLDADCAAAQhAAAIQgAAEIAABCDAUAFF/GIN1DM+PBYCo/ohMXDQ1WPjoeUZH1mMBEEh0oqLGvsHCy0S4NzWVWotJBogbvZB+brDwQT7UWSmXy5sxyQB9HQEROdVv4HQ+vx+QmS4iXsWmCK7Usu8AhOqAXMzlcn3VgWTbugQgEYrxMkZ/gyUPgnuhe2C6/Stxvdeg2ezMJERvhOuoZ+JBrNYBRuDdBtDuXkDM25nCHLbZSv9X6A4VHU+DpwCcbvbjcetLtTaOANtuirrux08HM0euisjDEMKC7RQuq+C+pVJqpzx3NZ3+eeBza9I0rWJgyHnxg2sAJrqnaHUzFcyN60Jox13hprv8aNopZBS4GcqWWVHM+lAkN0zY7ncgkYBukRoKLPpiXVj9UFkfV4Bdl8Jf60u3IMZZAG/6iLuhkDvaSZ74VqtUx3kp3NN7gUZt8RmA43a2eEY1OCfQ04AcBpAGkAKwpkBLIG8BfQE/eNJsvG/G4VlARj0BfjDBx2ECEIAABCAAAQhAAAIQgAAE+P/tN8YvpvbTDBOlAAAAAElFTkSuQmCC';

// Landscape image: 600 x 375
const landscapePngBytes = fs.readFileSync('assets/images/greyscale_bird.png');

// Portrait image: 1473 x 1854
const portraitPngBytes = fs.readFileSync('assets/images/small_mario.png');

// Square image: 120 x 120
const squarePngBytes = fs.readFileSync('assets/images/mario_emblem.png');

// JPEG image: 1920 x 1080 (landscape)
const jpegBytes = fs.readFileSync('assets/images/cat_riding_unicorn.jpg');

describe('PDFImage', () => {
  describe('embed() method', () => {
    it("clears the 'embedder' field after the first call", async () => {
      const pdfDoc = await PDFDocument.create();

      const bytes = toUint8Array(examplePngImage);
      const embedder = await PngEmbedder.for(bytes);
      const ref = pdfDoc.context.nextRef();
      const pdfImage = PDFImage.of(ref, pdfDoc, embedder);

      const embedderVariable = 'embedder';
      expect(pdfImage[embedderVariable]).toBeDefined();
      await pdfImage.embed();
      expect(pdfImage[embedderVariable]).toBeUndefined();
    });

    it('may be called multiple times without causing an error', async () => {
      const pdfDoc = await PDFDocument.create();

      const bytes = toUint8Array(examplePngImage);
      const embedder = await PngEmbedder.for(bytes);
      const ref = pdfDoc.context.nextRef();
      const pdfImage = PDFImage.of(ref, pdfDoc, embedder);

      await expect(pdfImage.embed()).resolves.not.toThrowError();
      await expect(pdfImage.embed()).resolves.not.toThrowError();
    });

    it('may be called in parallel without causing an error', async () => {
      const pdfDoc = await PDFDocument.create();

      const bytes = toUint8Array(examplePngImage);
      const embedder = await PngEmbedder.for(bytes);
      const ref = pdfDoc.context.nextRef();
      const pdfImage = PDFImage.of(ref, pdfDoc, embedder);

      // tslint:disable-next-line
      const task = () => pdfImage['embedTask'];

      expect(task()).toBeUndefined();

      const task1 = pdfImage.embed();
      const firstTask = task();

      const task2 = pdfImage.embed();
      const secondTask = task();

      await Promise.all([task1, task2]);

      expect(firstTask).toEqual(secondTask);
    });

    it('image is usable after embed for reading properties', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      await pdfImage.embed();

      // Properties should still be accessible after embed
      expect(pdfImage.width).toBe(600);
      expect(pdfImage.height).toBe(375);
      expect(pdfImage.size()).toEqual({ width: 600, height: 375 });
      expect(pdfImage.scale(0.5)).toEqual({ width: 300, height: 187.5 });
    });
  });

  describe('width and height properties', () => {
    it('returns correct dimensions for a landscape PNG image (600x375)', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      expect(pdfImage.width).toBe(600);
      expect(pdfImage.height).toBe(375);
    });

    it('returns correct dimensions for a portrait PNG image (1473x1854)', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(portraitPngBytes);
      expect(pdfImage.width).toBe(1473);
      expect(pdfImage.height).toBe(1854);
    });

    it('returns correct dimensions for a square PNG image (120x120)', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(squarePngBytes);
      expect(pdfImage.width).toBe(120);
      expect(pdfImage.height).toBe(120);
    });

    it('returns correct dimensions for a JPEG image (1920x1080)', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      expect(pdfImage.width).toBe(1920);
      expect(pdfImage.height).toBe(1080);
    });

    it('returns correct dimensions for a base64-encoded PNG (64x64)', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(examplePngImage);
      expect(pdfImage.width).toBe(64);
      expect(pdfImage.height).toBe(64);
    });
  });

  describe('size() method', () => {
    it('returns { width, height } matching the image dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const dims = pdfImage.size();
      expect(dims).toEqual({ width: 600, height: 375 });
    });

    it('returns the same values as the width and height properties', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      const dims = pdfImage.size();
      expect(dims.width).toBe(pdfImage.width);
      expect(dims.height).toBe(pdfImage.height);
    });

    it('returns correct dimensions for a square image', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(squarePngBytes);
      const dims = pdfImage.size();
      expect(dims).toEqual({ width: 120, height: 120 });
    });
  });

  describe('scale() method', () => {
    it('scale(1) returns original dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scale(1);
      expect(scaled.width).toBe(600);
      expect(scaled.height).toBe(375);
    });

    it('scale(0.5) returns half dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scale(0.5);
      expect(scaled.width).toBe(300);
      expect(scaled.height).toBe(187.5);
    });

    it('scale(2) returns double dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scale(2);
      expect(scaled.width).toBe(1200);
      expect(scaled.height).toBe(750);
    });

    it('scale(0.25) returns quarter dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      const scaled = pdfImage.scale(0.25);
      expect(scaled.width).toBe(480);
      expect(scaled.height).toBe(270);
    });

    it('scale(3) returns triple dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(squarePngBytes);
      const scaled = pdfImage.scale(3);
      expect(scaled.width).toBe(360);
      expect(scaled.height).toBe(360);
    });

    it('scale preserves aspect ratio', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const originalRatio = pdfImage.width / pdfImage.height;
      const scaled = pdfImage.scale(0.73);
      const scaledRatio = scaled.width / scaled.height;
      expect(scaledRatio).toBeCloseTo(originalRatio, 10);
    });
  });

  describe('scaleToFit() method', () => {
    it('landscape image: result width equals maxWidth when width is the constraint', async () => {
      const pdfDoc = await PDFDocument.create();
      // 600x375 landscape image
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scaleToFit(300, 1000);
      expect(scaled.width).toBeCloseTo(300, 5);
      expect(scaled.height).toBeLessThanOrEqual(1000);
    });

    it('landscape image: aspect ratio is preserved', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const originalRatio = pdfImage.width / pdfImage.height;
      const scaled = pdfImage.scaleToFit(300, 1000);
      const scaledRatio = scaled.width / scaled.height;
      expect(scaledRatio).toBeCloseTo(originalRatio, 5);
    });

    it('portrait image: result height equals maxHeight when height is the constraint', async () => {
      const pdfDoc = await PDFDocument.create();
      // 1473x1854 portrait image
      const pdfImage = await pdfDoc.embedPng(portraitPngBytes);
      const scaled = pdfImage.scaleToFit(5000, 500);
      expect(scaled.height).toBeCloseTo(500, 5);
      expect(scaled.width).toBeLessThanOrEqual(5000);
    });

    it('portrait image: aspect ratio is preserved', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(portraitPngBytes);
      const originalRatio = pdfImage.width / pdfImage.height;
      const scaled = pdfImage.scaleToFit(5000, 500);
      const scaledRatio = scaled.width / scaled.height;
      expect(scaledRatio).toBeCloseTo(originalRatio, 5);
    });

    it('square constraint: both dimensions fit within bounds', async () => {
      const pdfDoc = await PDFDocument.create();
      // 600x375 landscape
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scaleToFit(400, 400);
      expect(scaled.width).toBeLessThanOrEqual(400 + 0.001);
      expect(scaled.height).toBeLessThanOrEqual(400 + 0.001);
    });

    it('square constraint on landscape: width is the limiting dimension', async () => {
      const pdfDoc = await PDFDocument.create();
      // 600x375 landscape - width/height ratio = 1.6
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      const scaled = pdfImage.scaleToFit(400, 400);
      // Width should be the constraint since the image is wider
      expect(scaled.width).toBeCloseTo(400, 5);
      expect(scaled.height).toBeLessThan(400);
    });

    it('square constraint on portrait: height is the limiting dimension', async () => {
      const pdfDoc = await PDFDocument.create();
      // 1473x1854 portrait
      const pdfImage = await pdfDoc.embedPng(portraitPngBytes);
      const scaled = pdfImage.scaleToFit(400, 400);
      // Height should be the constraint since the image is taller
      expect(scaled.height).toBeCloseTo(400, 5);
      expect(scaled.width).toBeLessThan(400);
    });

    it('image smaller than bounds: returns scaled dimensions within bounds', async () => {
      const pdfDoc = await PDFDocument.create();
      // 120x120 square image, fitting into 500x500
      const pdfImage = await pdfDoc.embedPng(squarePngBytes);
      const scaled = pdfImage.scaleToFit(500, 500);
      // scaleToFit scales up to fit the bounding box as large as possible
      expect(scaled.width).toBeLessThanOrEqual(500 + 0.001);
      expect(scaled.height).toBeLessThanOrEqual(500 + 0.001);
    });

    it('image smaller than bounds: scales up to fill the bounding box', async () => {
      const pdfDoc = await PDFDocument.create();
      // 120x120 square image
      const pdfImage = await pdfDoc.embedPng(squarePngBytes);
      const scaled = pdfImage.scaleToFit(500, 500);
      // Square image in square box: should scale to 500x500
      expect(scaled.width).toBeCloseTo(500, 5);
      expect(scaled.height).toBeCloseTo(500, 5);
    });

    it('exact fit: image dimensions match bounds', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfImage = await pdfDoc.embedPng(landscapePngBytes);
      // Fit exactly to its own dimensions
      const scaled = pdfImage.scaleToFit(600, 375);
      expect(scaled.width).toBeCloseTo(600, 5);
      expect(scaled.height).toBeCloseTo(375, 5);
    });

    it('JPEG landscape image: fits within bounds with aspect ratio preserved', async () => {
      const pdfDoc = await PDFDocument.create();
      // 1920x1080 JPEG
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      const scaled = pdfImage.scaleToFit(800, 600);
      expect(scaled.width).toBeLessThanOrEqual(800 + 0.001);
      expect(scaled.height).toBeLessThanOrEqual(600 + 0.001);
      const originalRatio = pdfImage.width / pdfImage.height;
      const scaledRatio = scaled.width / scaled.height;
      expect(scaledRatio).toBeCloseTo(originalRatio, 5);
    });

    it('very narrow bounding box: width is the constraint', async () => {
      const pdfDoc = await PDFDocument.create();
      // 1920x1080 JPEG
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      const scaled = pdfImage.scaleToFit(100, 10000);
      expect(scaled.width).toBeCloseTo(100, 5);
      expect(scaled.height).toBeLessThanOrEqual(10000);
    });

    it('very short bounding box: height is the constraint', async () => {
      const pdfDoc = await PDFDocument.create();
      // 1920x1080 JPEG
      const pdfImage = await pdfDoc.embedJpg(jpegBytes);
      const scaled = pdfImage.scaleToFit(10000, 100);
      expect(scaled.height).toBeCloseTo(100, 5);
      expect(scaled.width).toBeLessThanOrEqual(10000);
    });
  });
});
