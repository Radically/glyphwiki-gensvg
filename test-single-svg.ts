import { Kage, Polygons } from "@kurgm/kage-engine";
import { Command } from "commander";
import * as fs from "fs";
import { postProcessPolygon } from "./utils";

const kage = new Kage();
const program = new Command();

const run = (
  dump_file_name: string,
  dump_all_file_name: string,
  glyphwiki_code: string
) => {
  const dump = fs.readFileSync(dump_file_name).toString().split("\n");
  const entries = dump.length - 2 - 3;
  console.log(`Finished reading dump, ${entries} entries`);

  for (let i = 2; i < dump.length - 3; i++) {
    const [name, related, data] = dump[i].split("|").map((s) => s.trim());
    kage.kBuhin.push(name, data);
  }

  const dumpAll = fs.readFileSync(dump_all_file_name).toString().split("\n");
  const entriesAll = dumpAll.length - 2 - 3;
  console.log(`Finished reading dumpAll, ${entriesAll} entries`);

  for (let i = 2; i < dumpAll.length - 3; i++) {
    const [name, related, data] = dumpAll[i].split("|").map((s) => s.trim());
    kage.kBuhin.push(name, data);
  }

  const polygons = new Polygons();
  kage.makeGlyph(polygons, glyphwiki_code);

  const svg = polygons.generateSVG(false);
  console.log(svg);
  console.log(postProcessPolygon(svg, false));
};

program
  .arguments("<dump_newest_only.txt> <dump_all_versions.txt> <uABCD-X>")
  .description(
    "glyphwiki-gensvg <path to dump_newest_only.txt> <path to dump_all_versions.txt> <u7956-k>"
  )
  .action((dump_file_name, dump_all_file_name, glyphwiki_code) => {
    run(dump_file_name, dump_all_file_name, glyphwiki_code);
  })
  .parse(process.argv);
