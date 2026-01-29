import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
declare class JavaScriptEmbedder {
    static for(script: string, scriptName: string): JavaScriptEmbedder;
    private readonly script;
    readonly scriptName: string;
    private constructor();
    embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef>;
}
export default JavaScriptEmbedder;
//# sourceMappingURL=JavaScriptEmbedder.d.ts.map