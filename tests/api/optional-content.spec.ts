import { describe, expect, it } from 'vitest';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
} from '../../src/index';

const ocg = (doc: PDFDocument, name?: string, hex = false): PDFRef => {
  const dict: Record<string, unknown> = { Type: 'OCG' };

  if (name !== undefined) {
    dict.Name = hex ? PDFHexString.fromText(name) : PDFString.of(name);
  }

  return doc.context.register(doc.context.obj(dict as any));
};

const install = (doc: PDFDocument, groups: PDFRef[], d?: object) => {
  const props = doc.context.obj({ OCGs: groups } as any) as PDFDict;

  if (d) props.set(PDFName.of('D'), doc.context.obj(d as any));
  doc.catalog.set(PDFName.of('OCProperties'), props);

  return props;
};

const state = (doc: PDFDocument) =>
  doc.getOptionalContentGroups().map((g) => [g.getName(), g.isOnByDefault()]);

describe('optional content groups', () => {
  it('registers reached layers once, preserves states and radio groups after reload', async () => {
    const source = await PDFDocument.create();
    const a = ocg(source, 'same');
    const b = ocg(source, 'same');
    const unused = ocg(source, 'unused');
    install(source, [a, b, unused], { BaseState: 'OFF', ON: [a], RBGroups: [[a, b, unused]] });
    const page = source.addPage();
    page.node.set(PDFName.Resources, source.context.obj({ Properties: { A: a, B: b } }));
    const destination = await PDFDocument.create();
    const pages = await destination.copyPages(source, [0, 0]);

    for (const copy of pages) destination.addPage(copy);
    expect(state(destination)).toEqual([['same', true], ['same', false]]);
    const groups = destination.getOptionalContentGroups();
    const resources = pages[0]!.node.Resources()!;
    expect(resources.lookup(PDFName.of('Properties'), PDFDict).get(PDFName.of('A'))).toBe(groups[0]!.ref);
    const reloaded = await PDFDocument.load(await destination.save());
    expect(state(reloaded)).toEqual([['same', true], ['same', false]]);
    reloaded.getOptionalContentGroups()[1]!.setOnByDefault(true);
    expect(state(reloaded)).toEqual([['same', false], ['same', true]]);
  });

  it('merges by ref with copy-on-write configuration and group arrays', async () => {
    const source = await PDFDocument.create();
    const a = ocg(source, 'same');
    install(source, [a]);
    source.addPage().node.set(PDFName.of('Annots'), source.context.obj([{ Type: 'Annot', OC: a }]));
    const destination = await PDFDocument.create();
    const existing = ocg(destination, 'same');
    const props = install(destination, [existing], { BaseState: 'OFF', OFF: [existing] });
    const oldD = props.lookup(PDFName.of('D'), PDFDict);
    const oldGroups = props.lookup(PDFName.of('OCGs'), PDFArray);
    props.set(PDFName.of('Configs'), destination.context.obj([oldD]));
    await destination.copyPages(source, [0]);
    expect(state(destination)).toEqual([['same', false], ['same', true]]);
    expect(oldGroups.asArray()).toEqual([existing]);
    expect(oldD.has(PDFName.of('ON'))).toBe(false);
    expect(state(source)).toEqual([['same', true]]);
  });

  it.each(['source', 'destination'])('refuses malformed %s configuration before catalog changes', async (which) => {
    const source = await PDFDocument.create();
    const a = ocg(source, 'A');
    install(source, [a], {});
    source.addPage().node.set(PDFName.Resources, source.context.obj({ Properties: { A: a } }));
    const destination = await PDFDocument.create();
    install(destination, [], {});
    const malformed = which === 'source' ? source : destination;
    malformed.catalog.lookup(PDFName.of('OCProperties'), PDFDict)
      .lookup(PDFName.of('D'), PDFDict).set(PDFName.of('RBGroups'), malformed.context.obj([5]));
    const before = destination.catalog.get(PDFName.of('OCProperties'));
    const serialized = before!.toString();
    await expect(destination.copyPages(source, [0])).rejects.toThrow(/RBGroups/);
    expect(destination.catalog.get(PDFName.of('OCProperties'))).toBe(before);
    expect(before!.toString()).toBe(serialized);
  });

  it('resolves an indirect /Type', async () => {
    const doc = await PDFDocument.create();
    const type = doc.context.register(PDFName.of('OCG'));
    const a = doc.context.register(doc.context.obj({ Type: type, Name: PDFString.of('A') }));
    install(doc, [a]);
    expect(state(doc)).toEqual([['A', true]]);
  });

  it('is empty without /OCProperties', async () => {
    const doc = await PDFDocument.create();
    expect(doc.getOptionalContentGroups()).toEqual([]);
  });

  it('lists /Type /OCG refs once, with decoded names and default state', async () => {
    const doc = await PDFDocument.create();
    const a = ocg(doc, 'A');
    const b = ocg(doc, 'Bé', true);
    const c = ocg(doc);
    const notOcg = doc.context.register(doc.context.obj({ Type: 'OCMD' }));
    install(doc, [a, b, a, c, notOcg] as any, { OFF: [b] });
    expect(state(doc)).toEqual([
      ['A', true],
      ['Bé', false],
      [undefined, true],
    ]);
  });

  it('honours BaseState OFF as recovery; OFF wins over ON', async () => {
    const doc = await PDFDocument.create();
    const a = ocg(doc, 'A');
    const b = ocg(doc, 'B');
    const c = ocg(doc, 'C');
    install(doc, [a, b, c], { BaseState: 'OFF', ON: [a, b], OFF: [b] });
    expect(state(doc)).toEqual([
      ['A', true],
      ['B', false],
      ['C', false],
    ]);
  });

  it('edits one group, keeps other entries, survives save and reload', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const a = ocg(doc, 'A');
    const b = ocg(doc, 'B');
    const stray = PDFRef.of(9999);
    install(doc, [a, b], { ON: [a, stray], OFF: [b, b] });
    const [ga, gb] = doc.getOptionalContentGroups();
    ga!.setOnByDefault(false);
    gb!.setOnByDefault(true);

    const d = doc.catalog
      .lookup(PDFName.of('OCProperties'), PDFDict)
      .lookup(PDFName.of('D'), PDFDict);

    expect(d.lookup(PDFName.of('ON'), PDFArray).asArray()).toEqual([stray, b]);
    expect(d.lookup(PDFName.of('OFF'), PDFArray).asArray()).toEqual([a]);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(state(reloaded)).toEqual([
      ['A', false],
      ['B', true],
    ]);
  });

  it('turns radio-button peers OFF, directly shared only', async () => {
    const doc = await PDFDocument.create();
    const [a, b, c] = [ocg(doc, 'A'), ocg(doc, 'B'), ocg(doc, 'C')];
    install(doc, [a, b, c], { ON: [a, b, c], RBGroups: [[a, b], [b, c]] });
    doc.getOptionalContentGroups()[0]!.setOnByDefault(true);
    expect(state(doc)).toEqual([
      ['A', true],
      ['B', false],
      ['C', true],
    ]);
    doc.getOptionalContentGroups()[0]!.setOnByDefault(false);
    expect(state(doc).map((s) => s[1])).toEqual([false, false, true]);
  });

  it('leaves a /D shared with /Configs alone and creates a missing /D', async () => {
    const doc = await PDFDocument.create();
    const a = ocg(doc, 'A');
    const shared = doc.context.register(doc.context.obj({ ON: [a] }));
    const props = install(doc, [a]);
    props.set(PDFName.of('D'), shared);
    props.set(PDFName.of('Configs'), doc.context.obj([shared]));
    doc.getOptionalContentGroups()[0]!.setOnByDefault(false);
    expect(doc.getOptionalContentGroups()[0]!.isOnByDefault()).toBe(false);
    const kept = doc.context.lookup(shared, PDFDict);
    expect(kept.lookup(PDFName.of('ON'), PDFArray).asArray()).toEqual([a]);

    const other = await PDFDocument.create();
    const o = ocg(other, 'O');
    install(other, [o]);
    other.getOptionalContentGroups()[0]!.setOnByDefault(false);
    expect(other.getOptionalContentGroups()[0]!.isOnByDefault()).toBe(false);
  });

  it('refuses, changing nothing, for a stale group or malformed /RBGroups', async () => {
    const doc = await PDFDocument.create();
    const a = ocg(doc, 'A');
    const props = install(doc, [a], { RBGroups: [5] });
    const [g] = doc.getOptionalContentGroups();
    const before = props.get(PDFName.of('D'));
    expect(() => g!.setOnByDefault(true)).toThrow(/RBGroups/);
    expect(() => g!.setOnByDefault(false)).toThrow(/RBGroups/);
    expect(props.get(PDFName.of('D'))).toBe(before);
    props.set(PDFName.of('OCGs'), doc.context.obj([]));
    expect(() => g!.setOnByDefault(false)).toThrow(/not an optional content group/);
  });

  it('records the edit in an incremental save', async () => {
    const base = await PDFDocument.create();
    base.addPage();
    const a = ocg(base, 'A');
    install(base, [a], { ON: [a] });
    const bytes = await base.save({ useObjectStreams: false });
    const doc = await PDFDocument.load(bytes, { forIncrementalUpdate: true });
    const snapshot = doc.takeSnapshot();
    doc.getOptionalContentGroups()[0]!.setOnByDefault(false);
    const delta = await doc.saveIncremental(snapshot);
    const full = new Uint8Array(bytes.length + delta.length);
    full.set(bytes);
    full.set(delta, bytes.length);
    const reloaded = await PDFDocument.load(full);
    expect(state(reloaded)).toEqual([['A', false]]);
  });
});
