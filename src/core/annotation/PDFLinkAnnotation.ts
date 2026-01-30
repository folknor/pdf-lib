import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFString from '../objects/PDFString.js';
import PDFAnnotation from './PDFAnnotation.js';

/**
 * Represents a PDF Link annotation.
 * Link annotations can contain either:
 * - A URI action (/A with /S = /URI) for external URLs
 * - A destination (/Dest) for internal document navigation
 */
class PDFLinkAnnotation extends PDFAnnotation {
  static override fromDict = (dict: PDFDict): PDFLinkAnnotation =>
    new PDFLinkAnnotation(dict);

  /**
   * Get the action dictionary (/A) if present.
   * @returns The action dictionary or undefined.
   */
  A(): PDFDict | undefined {
    return this.dict.lookupMaybe(PDFName.of('A'), PDFDict);
  }

  /**
   * Get the destination (/Dest) for internal links.
   * Destinations can be arrays, names, or strings.
   * @returns The destination or undefined.
   */
  Dest(): PDFArray | PDFName | PDFString | undefined {
    const dest = this.dict.lookup(PDFName.of('Dest'));
    if (
      dest instanceof PDFArray ||
      dest instanceof PDFName ||
      dest instanceof PDFString
    ) {
      return dest;
    }
    return;
  }

  /**
   * Get the URL from a URI action if present.
   * This extracts the URI from the /A action dictionary where /S is /URI.
   * @returns The URL string or undefined if not a URI action.
   */
  getUrl(): string | undefined {
    const action = this.A();
    if (!action) return;

    // Check that this is a URI action
    const actionType = action.lookup(PDFName.of('S'), PDFName);
    if (!actionType || actionType.toString() !== '/URI') return;

    // Get the URI value - can be PDFString, PDFHexString, or PDFName
    const uri = action.get(PDFName.of('URI'));

    if (uri instanceof PDFString) {
      return uri.asString();
    }
    if (uri instanceof PDFHexString) {
      return uri.decodeText();
    }
    if (uri instanceof PDFName) {
      // PDFName.decodeText() already strips the leading '/'
      return uri.decodeText();
    }

    return;
  }

  /**
   * Get the destination for internal document links.
   * Destinations specify a location within the document (page, position, zoom).
   * @returns The destination (PDFArray, PDFName, or PDFString) or undefined.
   */
  getDestination(): PDFArray | PDFName | PDFString | undefined {
    return this.Dest();
  }
}

export default PDFLinkAnnotation;
