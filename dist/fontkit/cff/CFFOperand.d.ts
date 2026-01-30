export interface ForceLargeValue {
    forceLarge: boolean;
    valueOf(): number;
}
export default class CFFOperand {
    static decode(stream: any, value: number): number | null;
    static size(value: number | ForceLargeValue): number;
    static encode(stream: any, value: number | ForceLargeValue): void;
}
//# sourceMappingURL=CFFOperand.d.ts.map