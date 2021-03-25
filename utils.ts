import * as ClipperLib from "clipper-lib";
import { parse } from "svg-parser";

export function precisionRound(number: number, precision: number) {
  var factor = Math.pow(10, precision);
  var n = precision < 0 ? number : 0.01 / factor + number;
  return Math.round(n * factor) / factor;
}

export const SCALE_FACTOR = 5;
export const postProcessPolygon = (
  svg: string,
  is_mincho: boolean,
  offset: boolean
) => {
  const parsedSVG = parse(svg);
  const polygonsPoints = parsedSVG.children[0].children[0].children
    .filter(({ tagName }) => tagName === "polygon")
    .map(({ properties }) => properties.points.trim()) as string[];

  let count = 0;
  const paths = [] as { X: number; Y: number }[][];
  for (let polygon of polygonsPoints) {
    const _polygon = [] as { X: number; Y: number }[];

    let invalidPath = false;
    for (let pair of polygon.split(" ")) {
      const [x, y] = pair.split(",").map((num) => Number(num));
      if (
        isNaN(x) ||
        isNaN(y) ||
        x === Number.NEGATIVE_INFINITY ||
        x === Number.POSITIVE_INFINITY ||
        y === Number.NEGATIVE_INFINITY ||
        y === Number.POSITIVE_INFINITY
      ) {
        console.log("isNaN! ", x, y);
        invalidPath = true;
        break;
      }
      const intPoint = new ClipperLib.IntPoint(x, y);
      _polygon.push(intPoint);
    }
    if (invalidPath) continue;
    if (ClipperLib.Clipper.Orientation(_polygon)) _polygon.reverse();
    paths.push(_polygon);
    count += 1;
  }

  //   if (!ClipperLib.Clipper.Orientation(paths))
  //     ClipperLib.Clipper.ReversePaths(paths);

  // flatten?

  const concat = (paths: { X: number; Y: number }[][]) => {
    const res = [];
    for (let i = 0; i < paths.length; i++) {
      if (!paths[i].length) continue;
      res.push(
        `M ${precisionRound(paths[i][0].X * SCALE_FACTOR, 2)} ${precisionRound(
          (200 - paths[i][0].Y) * SCALE_FACTOR,
          2
        )}`
      );

      //   res.push(`M ${paths[i][0].X} ${paths[i][0].Y}`);

      for (let j = 1; j < paths[i].length; j++) {
        res.push(
          `L ${precisionRound(
            paths[i][j].X * SCALE_FACTOR,
            2
          )} ${precisionRound((200 - paths[i][j].Y) * SCALE_FACTOR, 2)}`
        );

        // res.push(`L ${paths[i][j].X} ${paths[i][j].Y}`);
      }
      res.push("Z");
    }
    return res;
  };

  if (is_mincho && offset) {
    const co = new ClipperLib.ClipperOffset(2, 0.25);
    co.AddPaths(
      paths,
      ClipperLib.JoinType.jtRound,
      ClipperLib.EndType.etClosedPolygon
    );
    co.Execute(paths, 1.3);
  }

  let res = [];
  try {
    res = concat(
      ClipperLib.Clipper.SimplifyPolygons(
        paths,
        ClipperLib.PolyFillType.pftNonZero
      )
    );
  } catch (error) {
    console.error(error);
    res = concat(paths);
  }
  return res.join(" ");
};
