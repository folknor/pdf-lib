import { zlibSync } from "fflate";
import { DecodedStreamTooLargeError } from "../../src/core/errors";
import { PNG } from "../../src/utils/png";

describe("PNG", () => {
  it("can load images with alpha values greater than 1", () => {
    // This Uint8Array contains a PNG image composed of a single pixel. It was
    // generated with the following code in a browser:
    // ```
    // const ctx = c.getContext('2d');
    // ctx.fillStyle = 'rgba(255, 120, 80, 0.5)';
    // ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // ```
    // The pixel has the following values: R=255, G=120, B=80, A=128
    //
    // prettier-ignore
    const input = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      24, 87, 99, 248, 95, 17, 208, 0, 0, 6, 137, 2, 72, 25, 58, 220, 62, 0, 0,
      0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);

    const pngImage = PNG.load(input);

    expect(pngImage.rgbChannel).toEqual(new Uint8Array([255, 120, 80]));
    expect(pngImage.alphaChannel).toEqual(new Uint8Array([128]));
  });

  it("can load images from a Uint8Array with a non-zero byte offset", () => {
    // prettier-ignore
    const input = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      24, 87, 99, 248, 95, 17, 208, 0, 0, 6, 137, 2, 72, 25, 58, 220, 62, 0, 0,
      0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);

    const padded = new Uint8Array(input.length + 3);
    padded.set([0, 1, 2]);
    padded.set(input, 3);
    const pngImage = PNG.load(padded.subarray(3));

    expect(pngImage.rgbChannel).toEqual(new Uint8Array([255, 120, 80]));
    expect(pngImage.alphaChannel).toEqual(new Uint8Array([128]));
  });

  describe("decoded size cap", () => {
    // Builds a PNG from chunks; CRCs are zero since the decoder ignores them.
    const chunk = (type: string, body: Uint8Array) => {
      const c = new Uint8Array(12 + body.length);
      new DataView(c.buffer).setUint32(0, body.length);

      for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
      c.set(body, 8);

      return c;
    };

    const ihdr = (w: number, h: number, interlace = 0) => {
      const b = new Uint8Array(13);
      const v = new DataView(b.buffer);
      v.setUint32(0, w);
      v.setUint32(4, h);
      b[8] = 8; // depth
      b[9] = 6; // RGBA
      b[12] = interlace;

      return chunk("IHDR", b);
    };

    const png = (...chunks: Uint8Array[]) => {
      const sig = [137, 80, 78, 71, 13, 10, 26, 10];
      const parts = [new Uint8Array(sig), ...chunks, chunk("IEND", new Uint8Array(0))];
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;

      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }

      return out;
    };

    it("rejects a bomb from its header before inflating", () => {
      // 20000x20000 RGBA claims 1.6 GB decoded; the IDAT is a few KB of zeros.
      const idat = zlibSync(new Uint8Array(1024 * 1024));
      const bytes = png(ihdr(20000, 20000), chunk("IDAT", idat));
      expect(() => PNG.load(bytes)).toThrow(DecodedStreamTooLargeError);
    });

    it("honours an explicit cap", () => {
      // 2x2 RGBA: 16 RGBA8 bytes, filtered stream 2 * (1 + 8) = 18 bytes.
      const raw = new Uint8Array(18).fill(7);
      raw[0] = 0;
      raw[9] = 0;
      const bytes = png(ihdr(2, 2), chunk("IDAT", zlibSync(raw)));
      expect(() => PNG.load(bytes, 17)).toThrow(DecodedStreamTooLargeError);
      expect(PNG.load(bytes, 18).rgbChannel).toEqual(new Uint8Array(12).fill(7));
    });

    it("ignores inflated data past the image size", () => {
      const raw = new Uint8Array(1 + 4 + 100000).fill(9);
      raw[0] = 0;
      const bytes = png(ihdr(1, 1), chunk("IDAT", zlibSync(raw)));
      const img = PNG.load(bytes);
      expect(img.rgbChannel).toEqual(new Uint8Array([9, 9, 9]));
      expect(img.alphaChannel).toEqual(new Uint8Array([9]));
    });

    it("decodes an interlaced image", () => {
      // 1x1 Adam7: only pass 1 is non-empty, 1 filter byte + 4 pixel bytes.
      const raw = new Uint8Array([0, 1, 2, 3, 4]);
      const bytes = png(ihdr(1, 1, 1), chunk("IDAT", zlibSync(raw)));
      const img = PNG.load(bytes);
      expect(img.rgbChannel).toEqual(new Uint8Array([1, 2, 3]));
      expect(img.alphaChannel).toEqual(new Uint8Array([4]));
    });

    it("rejects an animated PNG without decoding frames", () => {
      const actl = new Uint8Array(8);
      new DataView(actl.buffer).setUint32(0, 2);
      // A frame bomb would be pointless: nothing is inflated.
      const bytes = png(ihdr(20000, 20000), chunk("acTL", actl));
      expect(() => PNG.load(bytes)).toThrow("Animated PNGs are not supported");
    });

    it("rejects a chunk that runs past the end of the data", () => {
      const bytes = png(ihdr(1, 1)).slice(0, -6);
      const bad = new Uint8Array(bytes.length);
      bad.set(bytes);
      new DataView(bad.buffer).setUint32(33, 0xfffffff0);
      expect(() => PNG.load(bad)).toThrow("Truncated PNG chunk");
    });
  });
});
