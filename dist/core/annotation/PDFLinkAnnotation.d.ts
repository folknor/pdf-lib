import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFString from '../objects/PDFString.js';
import PDFAnnotation from './PDFAnnotation.js';
/**
 * Represents a PDF Link annotation.
 * Link annotations can contain either:
 * - A URI action (/A with /S = /URI) for external URLs
 * - A destination (/Dest) for internal document navigation
 */
declare class PDFLinkAnnotation extends PDFAnnotation {
    static fromDict: (dict: PDFDict) => PDFLinkAnnotation;
    /**
     * Get the action dictionary (/A) if present.
     * @returns The action dictionary or undefined.
     */
    A(): PDFDict | undefined;
    /**
     * Get the destination (/Dest) for internal links.
     * Destinations can be arrays, names, or strings.
     * @returns The destination or undefined.
     */
    Dest(): PDFArray | PDFName | PDFString | undefined;
    /**
     * Get the URL from a URI action if present.
     * This extracts the URI from the /A action dictionary where /S is /URI.
     * @returns The URL string or undefined if not a URI action.
     */
    getUrl(): string | undefined;
    /**
     * Get the destination for internal document links.
     * Destinations specify a location within the document (page, position, zoom).
     * @returns The destination (PDFArray, PDFName, or PDFString) or undefined.
     */
    getDestination(): PDFArray | PDFName | PDFString | undefined;
}
export default PDFLinkAnnotation;
//# sourceMappingURL=PDFLinkAnnotation.d.ts.map