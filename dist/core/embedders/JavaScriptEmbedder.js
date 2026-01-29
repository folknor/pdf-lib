import PDFHexString from '../objects/PDFHexString.js';
class JavaScriptEmbedder {
    static for(script, scriptName) {
        return new JavaScriptEmbedder(script, scriptName);
    }
    script;
    scriptName;
    constructor(script, scriptName) {
        this.script = script;
        this.scriptName = scriptName;
    }
    async embedIntoContext(context, ref) {
        const jsActionDict = context.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFHexString.fromText(this.script),
        });
        if (ref) {
            context.assign(ref, jsActionDict);
            return ref;
        }
        else {
            return context.register(jsActionDict);
        }
    }
}
export default JavaScriptEmbedder;
//# sourceMappingURL=JavaScriptEmbedder.js.map