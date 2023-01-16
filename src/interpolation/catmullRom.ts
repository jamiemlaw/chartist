import type { SegmentData } from '../core';
import { splitIntoSegments } from '../core';
import { SvgPath } from '../svg';
import { none } from './none';

export interface CardinalInterpolationOptions {
  tension?: number;
  alpha?: number;
  fillHoles?: boolean;
}

/**
 * Cardinal / Catmull-Rome spline interpolation is the default smoothing function in Chartist. It produces nice results where the splines will always meet the points. It produces some artifacts though when data values are increased or decreased rapidly. The line may not follow a very accurate path and if the line should be accurate this smoothing function does not produce the best results.
 *
 * Cardinal splines can only be created if there are more than two data points. If this is not the case this smoothing will fallback to `Chartist.Smoothing.none`.
 *
 * All smoothing functions within Chartist are factory functions that accept an options parameter. The cardinal interpolation function accepts one configuration parameter `tension`, between 0 and 1, which controls the smoothing intensity.
 *
 * @example
 * ```ts
 * const chart = new LineChart('.ct-chart', {
 *   labels: [1, 2, 3, 4, 5],
 *   series: [[1, 2, 8, 1, 7]]
 * }, {
 *   lineSmooth: Interpolation.catmullRom({
 *     tension: 0,
 *     alpha: 0.5,
 *     fillHoles: false
 *   })
 * });
 * ```
 *
 * @param options The options of the cardinal factory function.
 */
export function cardinal(options?: CardinalInterpolationOptions) {
  const finalOptions = {
    tension: 0,
    alpha: 0.5,
    fillHoles: false,
    ...options
  };

  const t = Math.min(1, Math.max(0, finalOptions.tension));
  const c = 1 - t;
  const alpha = Math.min(1, Math.max(0, finalOptions.alpha));

  return function catmullRomInterpolation(
    pathCoordinates: number[],
    valueData: SegmentData[]
  ): SvgPath {
    // First we try to split the coordinates into segments
    // This is necessary to treat "holes" in line charts
    const segments = splitIntoSegments(pathCoordinates, valueData, {
      fillHoles: finalOptions.fillHoles
    });

    if (!segments.length) {
      // If there were no segments return 'none' interpolation
      return none()([], []);
    } else if (segments.length > 1) {
      // If the split resulted in more that one segment we need to interpolate each segment individually and join them
      // afterwards together into a single path.
      // For each segment we will recurse the cardinal function
      // Join the segment path data into a single path and return
      return SvgPath.join(
        segments.map(segment =>
          cardinalInterpolation(segment.pathCoordinates, segment.valueData)
        )
      );
    } else {
      // If there was only one segment we can proceed regularly by using pathCoordinates and valueData from the first
      // segment
      pathCoordinates = segments[0].pathCoordinates;
      valueData = segments[0].valueData;

      // If less than two points we need to fallback to no smoothing
      if (pathCoordinates.length <= 4) {
        return none()(pathCoordinates, valueData);
      }

      const path = new SvgPath().move(
        pathCoordinates[0],
        pathCoordinates[1],
        false,
        valueData[0]
      );

      for (
        let i = 0, iLen = pathCoordinates.length;
        iLen - 2 > i;
        i += 2
      ) {
        const p = [
          { x: +pathCoordinates[i - 2], y: +pathCoordinates[i - 1] },
          { x: +pathCoordinates[i], y: +pathCoordinates[i + 1] },
          { x: +pathCoordinates[i + 2], y: +pathCoordinates[i + 3] },
          { x: +pathCoordinates[i + 4], y: +pathCoordinates[i + 5] }
        ];
    
        const dx1 = p[1].x - p[0].x;
        const dy1 = p[1].y - p[0].y;
        const dx2 = p[2].x - p[1].x;
        const dy2 = p[2].y - p[1].y;
        const dx3 = p[3].x - p[2].x;
        const dy3 = p[3].y - p[2].y;
    
        const l1 = (dx1 * dx1 + dy1 * dy1) ** alpha;
        const l2 = (dx2 * dx2 + dy2 * dy2) ** alpha;
        const l3 = (dx3 * dx3 + dy3 * dy3) ** alpha;

        path.curve(
          i === 0 ? p[1].x : p[1].x + c * (dx1 * l2 + dx2 * l1) / (l1 + Math.sqrt(l1 * l2)) / 3,
          i === 0 ? p[1].y : p[1].y + c * (dy1 * l2 + dy2 * l1) / (l1 + Math.sqrt(l1 * l2)) / 3,
          i === iLen - 4 ? p[2].x : p[2].x - c * (dx3 * l2 + dx2 * l3) / (l3 + Math.sqrt(l3 * l2)) / 3,
          i === iLen - 4 ? p[2].y : p[2].y - c * (dy3 * l2 + dy2 * l3) / (l3 + Math.sqrt(l3 * l2)) / 3,
          p[2].x,
          p[2].y,
          false,
          valueData[(i + 2) / 2]
        );
      }

      return path;
    }
  };
}
