import { MethodNotImplementedError } from '../errors.js';
import type PDFContext from '../PDFContext.js';

class PDFObject {
  /**
   * Notifies the context that this object has been modified.
   * Used for incremental save support - tracks which objects need to be
   * written when saving incrementally.
   *
   * IMPORTANT: Mutable PDFObject subclasses (PDFArray, PDFDict, PDFRawStream)
   * must call this method in any method that modifies their contents.
   * Immutable objects (PDFName, PDFNumber, PDFBool, PDFString, etc.) do not
   * need to implement this as they cannot be modified after creation.
   */
  registerChange(): void {
    throw new MethodNotImplementedError(
      this.constructor.name,
      'registerChange',
    );
  }

  clone(_context?: PDFContext): PDFObject {
    throw new MethodNotImplementedError(this.constructor.name, 'clone');
  }

  toString(): string {
    throw new MethodNotImplementedError(this.constructor.name, 'toString');
  }

  sizeInBytes(): number {
    throw new MethodNotImplementedError(this.constructor.name, 'sizeInBytes');
  }

  copyBytesInto(_buffer: Uint8Array, _offset: number): number {
    throw new MethodNotImplementedError(this.constructor.name, 'copyBytesInto');
  }
}

export default PDFObject;
