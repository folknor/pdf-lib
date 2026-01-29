import PDFDict from '../objects/PDFDict.js';
import type PDFContext from '../PDFContext.js';
import type PDFPageLeaf from '../structures/PDFPageLeaf.js';
/**
 * Resource categories that can be referenced in PDF content streams.
 */
export interface UsedResources {
    Font: Set<string>;
    XObject: Set<string>;
    ExtGState: Set<string>;
    ColorSpace: Set<string>;
    Pattern: Set<string>;
    Shading: Set<string>;
    Properties: Set<string>;
}
/**
 * Analyzes a PDF page's content streams to determine which resources are actually used.
 *
 * This function decodes the page's content streams and uses regex patterns to find
 * references to named resources (fonts, images, etc.). This allows for optimized
 * page copying that only includes resources that are actually used.
 *
 * @param page - The PDF page leaf to analyze
 * @param context - The PDF context for dereferencing
 * @returns UsedResources object with sets of resource names per category,
 *          or undefined if analysis fails (caller should copy all resources)
 */
export declare function analyzePageResources(page: PDFPageLeaf, context: PDFContext): UsedResources | undefined;
/**
 * Filters a Resources dictionary to only include used resources.
 *
 * @param resources - The original Resources PDFDict
 * @param used - The UsedResources object from analyzePageResources
 * @param context - The PDF context for creating new objects
 * @returns A new PDFDict with only the used resources
 */
export declare function filterResources(resources: PDFDict, used: UsedResources, context: PDFContext): PDFDict;
declare const _default: {
    analyzePageResources: typeof analyzePageResources;
    filterResources: typeof filterResources;
};
export default _default;
//# sourceMappingURL=ContentStreamResourceAnalyzer.d.ts.map