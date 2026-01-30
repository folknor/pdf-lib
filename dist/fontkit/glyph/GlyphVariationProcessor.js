const TUPLES_SHARE_POINT_NUMBERS = 0x8000;
const TUPLE_COUNT_MASK = 0x0fff;
const EMBEDDED_TUPLE_COORD = 0x8000;
const INTERMEDIATE_TUPLE = 0x4000;
const PRIVATE_POINT_NUMBERS = 0x2000;
const TUPLE_INDEX_MASK = 0x0fff;
const POINTS_ARE_WORDS = 0x80;
const POINT_RUN_COUNT_MASK = 0x7f;
const DELTAS_ARE_ZERO = 0x80;
const DELTAS_ARE_WORDS = 0x40;
const DELTA_RUN_COUNT_MASK = 0x3f;
/**
 * This class is transforms TrueType glyphs according to the data from
 * the Apple Advanced Typography variation tables (fvar, gvar, and avar).
 * These tables allow infinite adjustments to glyph weight, width, slant,
 * and optical size without the designer needing to specify every exact style.
 *
 * Apple's documentation for these tables is not great, so thanks to the
 * Freetype project for figuring much of this out.
 *
 * @private
 */
export default class GlyphVariationProcessor {
    font;
    normalizedCoords;
    blendVectors;
    constructor(font, coords) {
        this.font = font;
        this.normalizedCoords = this.normalizeCoords(coords);
        this.blendVectors = new Map();
    }
    normalizeCoords(coords) {
        // the default mapping is linear along each axis, in two segments:
        // from the minValue to defaultValue, and from defaultValue to maxValue.
        const normalized = [];
        for (let i = 0; i < this.font.fvar.axis.length; i++) {
            const axis = this.font.fvar.axis[i];
            const coord = coords[i] ?? 0;
            if (coord < axis.defaultValue) {
                normalized.push((coord - axis.defaultValue + Number.EPSILON) /
                    (axis.defaultValue - axis.minValue + Number.EPSILON));
            }
            else {
                normalized.push((coord - axis.defaultValue + Number.EPSILON) /
                    (axis.maxValue - axis.defaultValue + Number.EPSILON));
            }
        }
        // if there is an avar table, the normalized value is calculated
        // by interpolating between the two nearest mapped values.
        if (this.font.avar) {
            for (let i = 0; i < this.font.avar.segment.length; i++) {
                const segment = this.font.avar.segment[i];
                for (let j = 0; j < segment.correspondence.length; j++) {
                    const pair = segment.correspondence[j];
                    if (j >= 1 && (normalized[i] ?? 0) < pair.fromCoord) {
                        const prev = segment.correspondence[j - 1];
                        normalized[i] =
                            (((normalized[i] ?? 0) - prev.fromCoord) *
                                (pair.toCoord - prev.toCoord) +
                                Number.EPSILON) /
                                (pair.fromCoord - prev.fromCoord + Number.EPSILON) +
                                prev.toCoord;
                        break;
                    }
                }
            }
        }
        return normalized;
    }
    transformPoints(gid, glyphPoints) {
        if (!this.font.fvar || !this.font.gvar) {
            return;
        }
        const { gvar } = this.font;
        if (gid >= gvar.glyphCount) {
            return;
        }
        const offset = gvar.offsets[gid];
        if (offset === gvar.offsets[gid + 1]) {
            return;
        }
        // Read the gvar data for this glyph
        const { stream } = this.font;
        stream.pos = offset;
        if (stream.pos >= stream.length) {
            return;
        }
        let tupleCount = stream.readUInt16BE();
        let offsetToData = offset + stream.readUInt16BE();
        let sharedPoints;
        if (tupleCount & TUPLES_SHARE_POINT_NUMBERS) {
            const here = stream.pos;
            stream.pos = offsetToData;
            sharedPoints = this.decodePoints();
            offsetToData = stream.pos;
            stream.pos = here;
        }
        const origPoints = glyphPoints.map((pt) => pt.copy());
        tupleCount &= TUPLE_COUNT_MASK;
        for (let i = 0; i < tupleCount; i++) {
            const tupleDataSize = stream.readUInt16BE();
            const tupleIndex = stream.readUInt16BE();
            let tupleCoords;
            if (tupleIndex & EMBEDDED_TUPLE_COORD) {
                tupleCoords = [];
                for (let a = 0; a < gvar.axisCount; a++) {
                    tupleCoords.push(stream.readInt16BE() / 16384);
                }
            }
            else {
                if ((tupleIndex & TUPLE_INDEX_MASK) >= gvar.globalCoordCount) {
                    throw new Error('Invalid gvar table');
                }
                tupleCoords = gvar.globalCoords[tupleIndex & TUPLE_INDEX_MASK];
            }
            let startCoords;
            let endCoords;
            if (tupleIndex & INTERMEDIATE_TUPLE) {
                startCoords = [];
                for (let a = 0; a < gvar.axisCount; a++) {
                    startCoords.push(stream.readInt16BE() / 16384);
                }
                endCoords = [];
                for (let a = 0; a < gvar.axisCount; a++) {
                    endCoords.push(stream.readInt16BE() / 16384);
                }
            }
            // Get the factor at which to apply this tuple
            const factor = this.tupleFactor(tupleIndex, tupleCoords, startCoords, endCoords);
            if (factor === 0) {
                offsetToData += tupleDataSize;
                continue;
            }
            const here = stream.pos;
            stream.pos = offsetToData;
            let points;
            if (tupleIndex & PRIVATE_POINT_NUMBERS) {
                points = this.decodePoints();
            }
            else {
                points = sharedPoints ?? new Uint16Array(0);
            }
            // points.length = 0 means there are deltas for all points
            const nPoints = points.length === 0 ? glyphPoints.length : points.length;
            const xDeltas = this.decodeDeltas(nPoints);
            const yDeltas = this.decodeDeltas(nPoints);
            if (points.length === 0) {
                // all points
                for (let j = 0; j < glyphPoints.length; j++) {
                    const point = glyphPoints[j];
                    if (point) {
                        point.x += Math.round((xDeltas[j] ?? 0) * factor);
                        point.y += Math.round((yDeltas[j] ?? 0) * factor);
                    }
                }
            }
            else {
                const outPoints = origPoints.map((pt) => pt.copy());
                const hasDelta = glyphPoints.map(() => false);
                for (let k = 0; k < points.length; k++) {
                    const idx = points[k];
                    if (idx !== undefined && idx < glyphPoints.length) {
                        const point = outPoints[idx];
                        if (point) {
                            hasDelta[idx] = true;
                            point.x += (xDeltas[k] ?? 0) * factor;
                            point.y += (yDeltas[k] ?? 0) * factor;
                        }
                    }
                }
                this.interpolateMissingDeltas(outPoints, origPoints, hasDelta);
                for (let m = 0; m < glyphPoints.length; m++) {
                    const outPt = outPoints[m];
                    const origPt = origPoints[m];
                    const glyphPt = glyphPoints[m];
                    if (outPt && origPt && glyphPt) {
                        const deltaX = outPt.x - origPt.x;
                        const deltaY = outPt.y - origPt.y;
                        glyphPt.x = Math.round(glyphPt.x + deltaX);
                        glyphPt.y = Math.round(glyphPt.y + deltaY);
                    }
                }
            }
            offsetToData += tupleDataSize;
            stream.pos = here;
        }
    }
    decodePoints() {
        const stream = this.font.stream;
        let count = stream.readUInt8();
        if (count & POINTS_ARE_WORDS) {
            count = ((count & POINT_RUN_COUNT_MASK) << 8) | stream.readUInt8();
        }
        const points = new Uint16Array(count);
        let i = 0;
        let point = 0;
        while (i < count) {
            const run = stream.readUInt8();
            const runCount = (run & POINT_RUN_COUNT_MASK) + 1;
            const fn = run & POINTS_ARE_WORDS ? stream.readUInt16 : stream.readUInt8;
            for (let j = 0; j < runCount && i < count; j++) {
                point += fn.call(stream);
                points[i++] = point;
            }
        }
        return points;
    }
    decodeDeltas(count) {
        const stream = this.font.stream;
        let i = 0;
        const deltas = new Int16Array(count);
        while (i < count) {
            const run = stream.readUInt8();
            const runCount = (run & DELTA_RUN_COUNT_MASK) + 1;
            if (run & DELTAS_ARE_ZERO) {
                i += runCount;
            }
            else {
                const fn = run & DELTAS_ARE_WORDS ? stream.readInt16BE : stream.readInt8;
                for (let j = 0; j < runCount && i < count; j++) {
                    deltas[i++] = fn.call(stream);
                }
            }
        }
        return deltas;
    }
    tupleFactor(tupleIndex, tupleCoords, startCoords, endCoords) {
        const normalized = this.normalizedCoords;
        const { gvar } = this.font;
        let factor = 1;
        for (let i = 0; i < gvar.axisCount; i++) {
            const tupleCoord = tupleCoords[i] ?? 0;
            const normalizedCoord = normalized[i] ?? 0;
            if (tupleCoord === 0) {
                continue;
            }
            if (normalizedCoord === 0) {
                return 0;
            }
            if ((tupleIndex & INTERMEDIATE_TUPLE) === 0) {
                if (normalizedCoord < Math.min(0, tupleCoord) ||
                    normalizedCoord > Math.max(0, tupleCoord)) {
                    return 0;
                }
                factor =
                    (factor * normalizedCoord + Number.EPSILON) /
                        (tupleCoord + Number.EPSILON);
            }
            else {
                const startCoord = startCoords?.[i] ?? 0;
                const endCoord = endCoords?.[i] ?? 0;
                if (normalizedCoord < startCoord || normalizedCoord > endCoord) {
                    return 0;
                }
                else if (normalizedCoord < tupleCoord) {
                    factor =
                        (factor * (normalizedCoord - startCoord + Number.EPSILON)) /
                            (tupleCoord - startCoord + Number.EPSILON);
                }
                else {
                    factor =
                        (factor * (endCoord - normalizedCoord + Number.EPSILON)) /
                            (endCoord - tupleCoord + Number.EPSILON);
                }
            }
        }
        return factor;
    }
    // Interpolates points without delta values.
    // Needed for the Ø and Q glyphs in Skia.
    // Algorithm from Freetype.
    interpolateMissingDeltas(points, inPoints, hasDelta) {
        if (points.length === 0) {
            return;
        }
        let point = 0;
        while (point < points.length) {
            const firstPoint = point;
            // find the end point of the contour
            let endPoint = point;
            let pt = points[endPoint];
            while (pt && !pt.endContour) {
                pt = points[++endPoint];
            }
            // find the first point that has a delta
            while (point <= endPoint && !hasDelta[point]) {
                point++;
            }
            if (point > endPoint) {
                continue;
            }
            const firstDelta = point;
            let curDelta = point;
            point++;
            while (point <= endPoint) {
                // find the next point with a delta, and interpolate intermediate points
                if (hasDelta[point]) {
                    this.deltaInterpolate(curDelta + 1, point - 1, curDelta, point, inPoints, points);
                    curDelta = point;
                }
                point++;
            }
            // shift contour if we only have a single delta
            if (curDelta === firstDelta) {
                this.deltaShift(firstPoint, endPoint, curDelta, inPoints, points);
            }
            else {
                // otherwise, handle the remaining points at the end and beginning of the contour
                this.deltaInterpolate(curDelta + 1, endPoint, curDelta, firstDelta, inPoints, points);
                if (firstDelta > 0) {
                    this.deltaInterpolate(firstPoint, firstDelta - 1, curDelta, firstDelta, inPoints, points);
                }
            }
            point = endPoint + 1;
        }
    }
    deltaInterpolate(p1, p2, ref1, ref2, inPoints, outPoints) {
        if (p1 > p2) {
            return;
        }
        const iterable = ['x', 'y'];
        for (let i = 0; i < iterable.length; i++) {
            const k = iterable[i];
            const inRef1 = inPoints[ref1];
            const inRef2 = inPoints[ref2];
            const outRef1 = outPoints[ref1];
            const outRef2 = outPoints[ref2];
            if (!inRef1 || !inRef2 || !outRef1 || !outRef2)
                continue;
            if (inRef1[k] > inRef2[k]) {
                const temp = ref1;
                ref1 = ref2;
                ref2 = temp;
            }
            const in1 = inPoints[ref1]?.[k] ?? 0;
            const in2 = inPoints[ref2]?.[k] ?? 0;
            const out1 = outPoints[ref1]?.[k] ?? 0;
            const out2 = outPoints[ref2]?.[k] ?? 0;
            // If the reference points have the same coordinate but different
            // delta, inferred delta is zero.  Otherwise interpolate.
            if (in1 !== in2 || out1 === out2) {
                const scale = in1 === in2 ? 0 : (out2 - out1) / (in2 - in1);
                for (let p = p1; p <= p2; p++) {
                    const inPt = inPoints[p];
                    const outPt = outPoints[p];
                    if (!inPt || !outPt)
                        continue;
                    let out = inPt[k];
                    if (out <= in1) {
                        out += out1 - in1;
                    }
                    else if (out >= in2) {
                        out += out2 - in2;
                    }
                    else {
                        out = out1 + (out - in1) * scale;
                    }
                    outPt[k] = out;
                }
            }
        }
    }
    deltaShift(p1, p2, ref, inPoints, outPoints) {
        const outRef = outPoints[ref];
        const inRef = inPoints[ref];
        if (!outRef || !inRef)
            return;
        const deltaX = outRef.x - inRef.x;
        const deltaY = outRef.y - inRef.y;
        if (deltaX === 0 && deltaY === 0) {
            return;
        }
        for (let p = p1; p <= p2; p++) {
            const outPt = outPoints[p];
            if (p !== ref && outPt) {
                outPt.x += deltaX;
                outPt.y += deltaY;
            }
        }
    }
    getAdvanceAdjustment(gid, table) {
        let outerIndex;
        let innerIndex;
        if (table.advanceWidthMapping) {
            let idx = gid;
            if (idx >= table.advanceWidthMapping.mapCount) {
                idx = table.advanceWidthMapping.mapCount - 1;
            }
            // _entryFormat is available but not used
            ({ outerIndex, innerIndex } = table.advanceWidthMapping.mapData[idx]);
        }
        else {
            outerIndex = 0;
            innerIndex = gid;
        }
        return this.getDelta(table.itemVariationStore, outerIndex, innerIndex);
    }
    // See pseudo code from `Font Variations Overview'
    // in the OpenType specification.
    getDelta(itemStore, outerIndex, innerIndex) {
        if (outerIndex >= itemStore.itemVariationData.length) {
            return 0;
        }
        const varData = itemStore.itemVariationData[outerIndex];
        if (innerIndex >= varData.deltaSets.length) {
            return 0;
        }
        const deltaSet = varData.deltaSets[innerIndex];
        const blendVector = this.getBlendVector(itemStore, outerIndex);
        let netAdjustment = 0;
        for (let master = 0; master < varData.regionIndexCount; master++) {
            netAdjustment +=
                (deltaSet.deltas[master] ?? 0) * (blendVector[master] ?? 0);
        }
        return netAdjustment;
    }
    getBlendVector(itemStore, outerIndex) {
        const varData = itemStore.itemVariationData[outerIndex];
        if (this.blendVectors.has(varData)) {
            return this.blendVectors.get(varData);
        }
        const normalizedCoords = this.normalizedCoords;
        const blendVector = [];
        // outer loop steps through master designs to be blended
        for (let master = 0; master < varData.regionIndexCount; master++) {
            let scalar = 1;
            const regionIndex = varData.regionIndexes[master];
            const axes = itemStore.variationRegionList.variationRegions[regionIndex];
            // inner loop steps through axes in this region
            for (let j = 0; j < axes.length; j++) {
                const axis = axes[j];
                let axisScalar;
                // compute the scalar contribution of this axis
                // ignore invalid ranges
                if (axis.startCoord > axis.peakCoord ||
                    axis.peakCoord > axis.endCoord) {
                    axisScalar = 1;
                }
                else if (axis.startCoord < 0 &&
                    axis.endCoord > 0 &&
                    axis.peakCoord !== 0) {
                    axisScalar = 1;
                    // peak of 0 means ignore this axis
                }
                else if (axis.peakCoord === 0) {
                    axisScalar = 1;
                    // ignore this region if coords are out of range
                }
                else if ((normalizedCoords[j] ?? 0) < axis.startCoord ||
                    (normalizedCoords[j] ?? 0) > axis.endCoord) {
                    axisScalar = 0;
                    // calculate a proportional factor
                }
                else {
                    const normCoord = normalizedCoords[j] ?? 0;
                    if (normCoord === axis.peakCoord) {
                        axisScalar = 1;
                    }
                    else if (normCoord < axis.peakCoord) {
                        axisScalar =
                            (normCoord - axis.startCoord + Number.EPSILON) /
                                (axis.peakCoord - axis.startCoord + Number.EPSILON);
                    }
                    else {
                        axisScalar =
                            (axis.endCoord - normCoord + Number.EPSILON) /
                                (axis.endCoord - axis.peakCoord + Number.EPSILON);
                    }
                }
                // take product of all the axis scalars
                scalar *= axisScalar;
            }
            blendVector[master] = scalar;
        }
        this.blendVectors.set(varData, blendVector);
        return blendVector;
    }
}
//# sourceMappingURL=GlyphVariationProcessor.js.map