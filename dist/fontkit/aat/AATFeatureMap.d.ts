interface MorxFeatures {
    [featureType: number]: {
        [featureSetting: number]: boolean;
    };
}
export declare function mapOTToAAT(inputFeatures: Record<string, boolean>): MorxFeatures;
export declare function mapAATToOT(inputFeatures: [number, number][] | Record<string, Record<string, boolean>>): string[];
export {};
//# sourceMappingURL=AATFeatureMap.d.ts.map