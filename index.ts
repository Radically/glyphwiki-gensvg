import { Command } from "commander";
import { Kage, Polygons } from "@kurgm/kage-engine";
import { parse } from "svg-parser";

import * as fs from "fs";

import * as ClipperLib from "clipper-lib";
import { precisionRound } from "./utils";

const kage = new Kage();
const program = new Command();

const SCALE_FACTOR = 4;
const GENERATE_CURVE = false;
const TEST_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" baseProfile="full" viewBox="0 0 200 200" width="200" height="200">
<g fill="black">
<polygon points="36,28 36,52 24,52 24,28 " />
<polygon points="24,28 50,28 50,32 24,32 " />
<polygon points="60,28 80,28 80,32 60,32 " />
<polygon points="90,28 110,28 110,32 90,32 " />
<polygon points="120,28 140,28 140,32 120,32 " />
<polygon points="150,28 176,28 176,32 150,32 " />
<polygon points="176,28 176,52 164,52 164,28 " />
<polygon points="35.5,58 35.5,82 24.5,82 24.5,58 " />
<polygon points="35.5,88 35.5,112 24.5,112 24.5,88 " />
<polygon points="35.5,118 35.5,142 24.5,142 24.5,118 " />
<polygon points="36,148 36,172 24,172 24,148 " />
<polygon points="24,168 50,168 50,172 24,172 " />
<polygon points="60,168 80,168 80,172 60,172 " />
<polygon points="90,168 110,168 110,172 90,172 " />
<polygon points="120,168 140,168 140,172 120,172 " />
<polygon points="176,148 176,172 164,172 164,148 " />
<polygon points="150,168 176,168 176,172 150,172 " />
<polygon points="176,58 176,82 164,82 164,58 " />
<polygon points="176,88 176,112 164,112 164,88 " />
<polygon points="176,118 176,142 164,142 164,118 " />
<polygon points="52.5,71.2 52.5,129.2 44.5,129.2 44.5,71.2 " />
<polygon points="51.2,72.4 76.7,128 71.2,128 45.7,72.4 " />
<polygon points="52.9,72.4 76.7,124 71.2,124 47.4,72.4 " />
<polygon points="54.6,72.4 76.7,120.8 71.2,120.8 49.1,72.4 " />
<polygon points="78,71.2 78,129.2 70,129.2 70,71.2 " />
<polygon points="42.5,71.2 49.3,71.2 49.3,75.2 42.5,75.2 " />
<polygon points="42.5,125.2 54.4,125.2 54.4,129.2 42.5,129.2 " />
<polygon points="68,71.2 79.9,71.2 79.9,75.2 68,75.2 " />
<polygon points="92.6,71.2 92.6,106.4 82.6,106.4 82.6,71.2 " />
<polygon points="93.6,103.2 93.4,108.2 93.4,112.4 93.7,115.8 94.2,118.4 94.9,120.5 95.8,122.1 97,123.6 98.8,124.8 101.2,125.9 104.1,126.3 104.2,128 101.1,128.5 97.9,128.8 94.8,128.5 91.7,127.2 88.9,125.1 86.5,122.2 84.6,118.5 83.2,114.1 82.2,109 81.6,103.2 " />
<polygon points="93.6,103.2 93.3,108.7 93.3,113 93.5,116.4 93.9,118.8 94.4,120.6 95.1,122 96.3,123.3 98.3,124.5 100.9,125.7 104.2,126.3 104.1,128 100.7,128.2 97.5,128.5 94.3,128.3 91.3,127.3 88.5,125.3 86.1,122.5 84.4,118.8 83.1,114.5 82.2,109.3 81.6,103.2 " />
<polygon points="119,103 119.1,108.2 118.7,112.8 117.9,116.9 116.6,120.5 114.9,123.5 112.6,126 109.9,127.9 106.8,129.1 103.4,129.6 99.8,129.6 100.1,124.7 103,124.7 105.5,124.2 107.6,123.4 109.3,122.2 110.8,120.6 112.1,118.4 113,115.6 113.7,112.1 114.1,108 114,103.3 " />
<polygon points="120.5,71.2 120.5,106.4 112.5,106.4 112.5,71.2 " />
<polygon points="80.8,71.2 95.3,71.2 95.3,75.2 80.8,75.2 " />
<polygon points="111.4,71.2 121.6,71.2 121.6,75.2 111.4,75.2 " />
<polygon points="134.7,71.2 134.7,129.2 124.7,129.2 124.7,71.2 " />
<polygon points="122.9,125.2 155.7,125.2 155.7,129.2 122.9,129.2 " />
<polygon points="122.9,71.2 136.5,71.2 136.5,75.2 122.9,75.2 " />
<polygon points="148.1,125.8 148.8,125 149.5,124.2 150.3,123.2 151.1,122.1 152,120.9 152.9,119.6 153.9,118.1 155,116.6 156.3,114.9 156.9,112.9 158.6,113.4 158.2,115.4 158.3,117.5 158.4,119.4 158.6,121.2 158.7,122.8 158.9,124.2 159,125.5 159.3,126.7 159.5,127.7 159.8,128.5 " />
</g>
</svg>
`;

const postProcessPolygon = (svg: string) => {
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
        `M ${paths[i][0].X * SCALE_FACTOR} ${precisionRound(
          (200 - paths[i][0].Y) * SCALE_FACTOR,
          2
        )}`
      );

      //   res.push(`M ${paths[i][0].X} ${paths[i][0].Y}`);

      for (let j = 1; j < paths[i].length; j++) {
        res.push(
          `L ${paths[i][j].X * SCALE_FACTOR} ${precisionRound(
            (200 - paths[i][j].Y) * SCALE_FACTOR,
            2
          )}`
        );

        // res.push(`L ${paths[i][j].X} ${paths[i][j].Y}`);
      }
      res.push("Z");
    }
    return res;
  };

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

/* const postProcessCurve = (svg: string) => {
  const parsedSVG = parse(svg);
  console.log(
    parsedSVG.children[0].children
      .filter(({ type, tagName }) => type === "element" && tagName === "path")
      .map(({ properties: { d } }) => d)
      .join(" ")
  );
};

const postProcess = (svg: string, curve: boolean) => {
  if (!curve) return postProcessPolygon(svg);
  else return postProcessCurve(svg);
}; */

const run = (dump_file_name: string, output: string) => {
  //   map of name to svg
  const res = { svg_paths: {} } as {
    side_length: number;
    ts: string;
    svg_paths: {
      [key: string]: string;
    };
  };

  const dump = fs.readFileSync(dump_file_name).toString().split("\n");

  console.log(`Finished reading dump, ${dump.length - 2 - 3} entries`);

  const names = [];
  for (let i = 2; i < dump.length - 3; i++) {
    const [name, related, data] = dump[i].split("|").map((s) => s.trim());
    names.push(name);
    kage.kBuhin.push(name, data);
  }

  /* {
    const polygons = new Polygons();
    kage.makeGlyph(polygons, "hkcs_m31184");
    const svg = polygons.generateSVG(GENERATE_CURVE);
    // console.log(svg);
    console.log(postProcess(svg, GENERATE_CURVE));
    console.log("gabagool");
  } */

  //   return;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    console.log(`${i}/${names.length}`);
    const polygons = new Polygons();
    kage.makeGlyph(polygons, name);
    // @ts-ignore
    res.svg_paths[name] = postProcessPolygon(polygons.generateSVG());
  }

  res.ts = new Date().toISOString();
  res.side_length = 200 * SCALE_FACTOR;

  fs.writeFileSync(output, JSON.stringify(res));

  /* let polygons = new Polygons();
  kage.makeGlyph(polygons, "zzzfelis_livermorium");
  //   @ts-ignore
  console.log(polygons.generateSVG());

  polygons = new Polygons();
  kage.makeGlyph(polygons, "u0000");
  //   @ts-ignore
  console.log(polygons.generateSVG()); */

  //   postProcess(TEST_SVG);
};

program
  .arguments("<dump_newest_only.txt> <output.json>")
  .description("glyphwiki-gensvg <path to dump_newest_only.txt> <output.json>")
  .action((dump_file_name, output) => {
    run(dump_file_name, output);
  })
  .parse(process.argv);
