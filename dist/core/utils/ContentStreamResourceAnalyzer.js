import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFStream from '../objects/PDFStream.js';
import { decodePDFRawStream } from '../streams/decode.js';
import PDFContentStream from '../structures/PDFContentStream.js';
/**
 * Creates an empty UsedResources object.
 */
function createEmptyUsedResources() {
    return {
        Font: new Set(),
        XObject: new Set(),
        ExtGState: new Set(),
        ColorSpace: new Set(),
        Pattern: new Set(),
        Shading: new Set(),
        Properties: new Set(),
    };
}
/**
 * Regex patterns for PDF content stream operators that reference resources.
 *
 * PDF operator syntax: operands followed by operator name
 * Resource names are PDF names starting with /
 *
 * Patterns match: /ResourceName operator
 */
const RESOURCE_PATTERNS = [
    // /FontName fontSize Tf - Text font
    { pattern: /\/([^\s/[\]<>()]+)\s+[\d.-]+\s+Tf\b/g, category: 'Font' },
    // /XObjectName Do - XObject (images, forms)
    { pattern: /\/([^\s/[\]<>()]+)\s+Do\b/g, category: 'XObject' },
    // /ExtGStateName gs - Extended graphics state
    { pattern: /\/([^\s/[\]<>()]+)\s+gs\b/g, category: 'ExtGState' },
    // /ColorSpaceName cs - Set color space (non-stroking)
    { pattern: /\/([^\s/[\]<>()]+)\s+cs\b/g, category: 'ColorSpace' },
    // /ColorSpaceName CS - Set color space (stroking)
    { pattern: /\/([^\s/[\]<>()]+)\s+CS\b/g, category: 'ColorSpace' },
    // /PatternName scn - Set color with pattern (non-stroking)
    // Pattern name is the last operand before scn
    { pattern: /\/([^\s/[\]<>()]+)\s+scn\b/g, category: 'Pattern' },
    // /PatternName SCN - Set color with pattern (stroking)
    { pattern: /\/([^\s/[\]<>()]+)\s+SCN\b/g, category: 'Pattern' },
    // /ShadingName sh - Paint shading
    { pattern: /\/([^\s/[\]<>()]+)\s+sh\b/g, category: 'Shading' },
    // /PropertiesName BDC - Begin marked content with properties
    { pattern: /\/\w+\s+\/([^\s/[\]<>()]+)\s+BDC\b/g, category: 'Properties' },
    // /PropertiesName DP - Define marked content point with properties
    { pattern: /\/\w+\s+\/([^\s/[\]<>()]+)\s+DP\b/g, category: 'Properties' },
];
/**
 * Decodes a content stream and returns its text content.
 */
function decodeContentStream(stream) {
    try {
        if (stream instanceof PDFRawStream) {
            const decoded = decodePDFRawStream(stream);
            const bytes = decoded.decode();
            // Convert bytes to string - content streams are ASCII-based
            return String.fromCharCode(...bytes);
        }
        if (stream instanceof PDFContentStream) {
            return stream.getContentsString();
        }
        return undefined;
    }
    catch {
        // If decoding fails (unsupported filter, etc.), return undefined
        // Caller should fall back to copying all resources
        return undefined;
    }
}
/**
 * Extracts resource names from content stream text using regex patterns.
 */
function extractResourcesFromText(text, used) {
    for (const { pattern, category } of RESOURCE_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const name = match[1];
            if (name) {
                used[category].add(name);
            }
        }
    }
    return used;
}
/**
 * Recursively analyzes an XObject Form to find additional resource references.
 * Form XObjects can have their own Resources dictionary and content stream.
 */
function analyzeFormXObject(xobject, context, used, visitedRefs) {
    // Get the XObject's content
    const text = decodeContentStream(xobject);
    if (text) {
        extractResourcesFromText(text, used);
    }
    // Form XObjects can have their own Resources that reference other XObjects
    const formResources = xobject.dict.lookup(PDFName.Resources);
    if (formResources instanceof PDFDict) {
        // Check for nested XObject references
        const xobjectDict = formResources.lookup(PDFName.XObject);
        if (xobjectDict instanceof PDFDict) {
            for (const name of used.XObject) {
                const ref = xobjectDict.get(PDFName.of(name));
                if (ref) {
                    const refKey = ref.toString();
                    if (!visitedRefs.has(refKey)) {
                        visitedRefs.add(refKey);
                        const nestedXObject = context.lookup(ref);
                        if (nestedXObject instanceof PDFStream) {
                            const subtype = nestedXObject.dict.get(PDFName.Subtype);
                            if (subtype === PDFName.Form) {
                                analyzeFormXObject(nestedXObject, context, used, visitedRefs);
                            }
                        }
                    }
                }
            }
        }
    }
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
export function analyzePageResources(page, context) {
    const used = createEmptyUsedResources();
    const contents = page.Contents();
    if (!contents) {
        // Page has no content streams, no resources needed
        return used;
    }
    // Collect all content streams
    const streams = [];
    if (contents instanceof PDFStream) {
        streams.push(contents);
    }
    else if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
            const streamRef = contents.get(i);
            const stream = context.lookup(streamRef);
            if (stream instanceof PDFStream) {
                streams.push(stream);
            }
        }
    }
    // Decode and analyze each content stream
    for (const stream of streams) {
        const text = decodeContentStream(stream);
        if (text === undefined) {
            // Decoding failed - can't safely optimize, copy all resources
            return undefined;
        }
        extractResourcesFromText(text, used);
    }
    // Analyze Form XObjects that are referenced (they may reference additional resources)
    const resources = page.Resources();
    if (resources) {
        const xobjectDict = resources.lookup(PDFName.XObject);
        if (xobjectDict instanceof PDFDict) {
            const visitedRefs = new Set();
            for (const name of used.XObject) {
                const ref = xobjectDict.get(PDFName.of(name));
                if (ref) {
                    const refKey = ref.toString();
                    if (!visitedRefs.has(refKey)) {
                        visitedRefs.add(refKey);
                        const xobject = context.lookup(ref);
                        if (xobject instanceof PDFStream) {
                            const subtype = xobject.dict.get(PDFName.Subtype);
                            if (subtype === PDFName.Form) {
                                analyzeFormXObject(xobject, context, used, visitedRefs);
                            }
                        }
                    }
                }
            }
        }
    }
    return used;
}
/**
 * Filters a Resources dictionary to only include used resources.
 *
 * @param resources - The original Resources PDFDict
 * @param used - The UsedResources object from analyzePageResources
 * @param context - The PDF context for creating new objects
 * @returns A new PDFDict with only the used resources
 */
export function filterResources(resources, used, context) {
    const filtered = context.obj({});
    // Resource category mapping: PDFName static -> UsedResources key
    const categories = [
        { pdfName: PDFName.Font, key: 'Font' },
        { pdfName: PDFName.XObject, key: 'XObject' },
        { pdfName: PDFName.ExtGState, key: 'ExtGState' },
        { pdfName: PDFName.ColorSpace, key: 'ColorSpace' },
        { pdfName: PDFName.Pattern, key: 'Pattern' },
        { pdfName: PDFName.Shading, key: 'Shading' },
        { pdfName: PDFName.Properties, key: 'Properties' },
    ];
    for (const { pdfName, key } of categories) {
        const categoryDict = resources.lookup(pdfName);
        if (categoryDict instanceof PDFDict && used[key].size > 0) {
            const filteredCategory = context.obj({});
            for (const name of used[key]) {
                const value = categoryDict.get(PDFName.of(name));
                if (value) {
                    filteredCategory.set(PDFName.of(name), value);
                }
            }
            if (filteredCategory.entries().length > 0) {
                filtered.set(pdfName, filteredCategory);
            }
        }
    }
    // Copy non-filterable resource categories as-is
    // ProcSet is deprecated but still common
    const procSet = resources.get(PDFName.of('ProcSet'));
    if (procSet) {
        filtered.set(PDFName.of('ProcSet'), procSet);
    }
    return filtered;
}
export default {
    analyzePageResources,
    filterResources,
};
//# sourceMappingURL=ContentStreamResourceAnalyzer.js.map