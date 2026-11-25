import { splitRelevantHits } from './CatalogSearchService';

interface ITestHit {
  resourceMetadata: Record<string, unknown>;
  extracts: Array<{ text: string; relevanceScore: number }>;
}

const hit = (name: string, score: number): ITestHit => ({
  resourceMetadata: { Name: name },
  extracts: [{ text: name, relevanceScore: score }]
});

const names = (hits: Array<{ resourceMetadata?: Record<string, unknown> }>): string[] =>
  hits.map((h) => String(h.resourceMetadata?.Name));

describe('splitRelevantHits (scores captured from the Copilot Retrieval API)', () => {
  it('keeps video tools and moves weak matches to possible matches', () => {
    const { primary, secondary } = splitRelevantHits([
      hit('Camtasia', 0.688),
      hit('Adobe Creative Cloud', 0.703),
      hit('QuickTime Pro', 0.685),
      hit('Install Software', 0.662),
      hit('Snagit', 0.66),
      hit('Visio Pro for Office 365', 0.651)
    ]);
    expect(names(primary)).toEqual(['Adobe Creative Cloud', 'Camtasia', 'QuickTime Pro']);
    expect(names(secondary)).toEqual(['Install Software', 'Snagit', 'Visio Pro for Office 365']);
  });

  it('keeps developer laptops first and always returns at least three', () => {
    const { primary, secondary } = splitRelevantHits([
      hit('Developer Laptop (Mac)', 0.711),
      hit('Development Laptop (PC)', 0.75),
      hit('Standard Laptop', 0.696),
      hit('Loaner Laptop', 0.659),
      hit('IntelliJ IDEA', 0.678),
      hit('Sales Laptop', 0.682)
    ]);
    expect(names(primary)).toEqual(['Development Laptop (PC)', 'Developer Laptop (Mac)', 'Standard Laptop']);
    expect(secondary).toHaveLength(3);
  });

  it('keeps the API order when no scores are returned', () => {
    const { primary, secondary } = splitRelevantHits([
      { resourceMetadata: { Name: 'A' } },
      { resourceMetadata: { Name: 'B' } }
    ]);
    expect(names(primary)).toEqual(['A', 'B']);
    expect(secondary).toHaveLength(0);
  });
});
