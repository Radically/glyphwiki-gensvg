import { Command } from "commander";
import { Kage, Polygons } from "@kurgm/kage-engine";
// import * as os from "os";
import * as fs from "fs";
import * as cluster from "cluster";
import { postProcessPolygon, SCALE_FACTOR } from "./utils";

// const numCPUs = os.cpus().length;

const kage = new Kage();
const program = new Command();

const END_MESSAGE = 1;
// const SVG_PATHS_MESSAGE = 2;

function chunk<Type>(array: Type[], chunkSize: number) {
  var tempArray = [];
  for (var i = 0; i < array.length; i += chunkSize) {
    tempArray.push(array.slice(i, i + chunkSize));
  }
  return tempArray;
}

const workerProcess = () => {
  console.log(`Worker ${process.pid} started`);

  process.on(
    "message",
    function ({
      msg: {
        index,
        is_mincho,
        offset,
        output,
        names,
        dump_file_name,
        dump_all_file_name,
      },
    }: {
      msg: {
        index: number;
        is_mincho: number;
        offset: number;
        output: string;
        dump_file_name: string;
        dump_all_file_name: string;
        names: string[];
      };
    }) {
      console.log(
        `Worker ${process.pid} receives message! ${names.length} characters`
      );

      kage.kShotai = is_mincho ? kage.kMincho : kage.kGothic;

      const dump = fs.readFileSync(dump_file_name).toString().split("\n");

      console.log(
        `Finished reading dump in worker ${process.pid}, ${
          dump.length - 2 - 3
        } entries`
      );

      for (let i = 2; i < dump.length - 3; i++) {
        const [name, related, data] = dump[i].split("|").map((s) => s.trim());
        kage.kBuhin.push(name, data);
      }

      const dumpAll = fs
        .readFileSync(dump_all_file_name)
        .toString()
        .split("\n");
      console.log(
        `Finished reading dumpAll in worker ${process.pid}, ${
          dumpAll.length - 2 - 3
        } entries`
      );

      for (let i = 2; i < dumpAll.length - 3; i++) {
        const [name, related, data] = dumpAll[i]
          .split("|")
          .map((s) => s.trim());
        kage.kBuhin.push(name, data);
      }

      const res = {} as { [key: string]: string };

      for (let i = 0; i < (process.env.TEST_RUN ? 20 : names.length); i++) {
        const name = names[i];
        // console.log(`W ${process.pid} ${i}/${names.length}`);
        const polygons = new Polygons();
        kage.makeGlyph(polygons, name);
        res[name] = postProcessPolygon(
          // @ts-ignore
          polygons.generateSVG(),
          !!is_mincho,
          !!offset
        );
      }

      // write to disk
      const out = fs.openSync(output + `.${index}`, "w");

      for (let key in res) {
        fs.writeSync(out, `${key} ${res[key]}\n`);
      }

      //   process.send({ msg: { type: SVG_PATHS_MESSAGE, svg_paths: res } });
      process.send({ msg: { type: END_MESSAGE } });

      process.exit();
    }
  );
};

const run = (
  dump_file_name: string,
  is_mincho: number,
  offset: number,
  dump_all_file_name: string,
  output: string,
  numCPUs: number
) => {
  const workers = [];
  //   map of name to svg
  const res = {} as { [key: string]: string };

  const dump = fs.readFileSync(dump_file_name).toString().split("\n");
  const entries = dump.length - 2 - 3;
  console.log(`Finished reading dump, ${entries} entries`);

  const names = [];
  for (let i = 2; i < dump.length - 3; i++) {
    const [name, related, data] = dump[i].split("|").map((s) => s.trim());
    names.push(name);
    // kage.kBuhin.push(name, data);
  }

  //   const chunkedNames = chunk(names.slice(0, 12), 12 / numCPUs);
  const chunkedNames = chunk(names, names.length / numCPUs);

  let pendingWorkers = numCPUs;

  const finish = () => {
    console.log("Writing metadata.");
    const out = fs.createWriteStream(output + ".meta", {
      flags: "w",
    });

    out.write(`${new Date().toISOString()} ${200 * SCALE_FACTOR} ${entries}\n`);

    // for (let key in res) out.write(`${key} ${res[key]}\n`);
  };

  for (let i = 0; i < numCPUs; i++) {
    console.log(`Forking process number ${i}...`);
    const worker = cluster.fork();
    workers.push(worker);

    /* worker.on(
      "message",
      ({ msg: svg_paths }: { msg: { [key: string]: string } }) => {
        console.log(`Worker ${worker.process.pid} done.`);
        for (let key in svg_paths) res[key] = svg_paths[key];
        pendingWorkers -= 1;
        if (pendingWorkers === 0) finish();
      }
    ); */

    worker.on("message", ({ msg }) => {
      /* if (msg.type === SVG_PATHS_MESSAGE) {
        console.log("received workers svg path message");
        for (let key in msg.svg_paths) res[key] = msg.svg_paths[key];
      } else  */
      if (msg.type === END_MESSAGE) {
        pendingWorkers -= 1;
        if (pendingWorkers === 0) finish();
      }
    });

    worker.send({
      msg: {
        index: i,
        is_mincho,
        offset,
        output,
        dump_file_name,
        dump_all_file_name,
        names: chunkedNames[i],
      },
    });
  }

  /* for (let i = 0; i < names.length; i++) {
    const name = names[i];
    console.log(`${i}/${names.length}`);
    const polygons = new Polygons();
    kage.makeGlyph(polygons, name);
    // @ts-ignore
    res.svg_paths[name] = postProcessPolygon(polygons.generateSVG());
  }

  res.ts = new Date().toISOString();
  res.side_length = 200 * SCALE_FACTOR;
  fs.writeFileSync(output, JSON.stringify(res)); */
};

if (cluster.isMaster)
  program
    .arguments(
      "<numThreads> <mincho/gothic> <offset> <dump_newest_only.txt> <dump_all_versions.txt> <output.json>"
    )
    .description(
      "glyphwiki-gensvg <numThreads> <1 for mincho, 0 for gothic> <1 to faux bold if mincho is enabled, 0 otherwise> <path to dump_newest_only.txt> <path to dump_all_versions.txt> <output.json>"
    )
    .action(
      (
        numThreads,
        is_mincho,
        offset,
        dump_file_name,
        dump_all_versions,
        output
      ) => {
        run(
          dump_file_name,
          Number(is_mincho),
          Number(offset),
          dump_all_versions,
          output,
          Number(numThreads)
        );
      }
    )
    .parse(process.argv);
else workerProcess();
