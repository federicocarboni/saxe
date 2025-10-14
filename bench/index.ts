// This benchmark also measures startup time

export interface ReadTokens {
  comments: number;
  processingInstructions: number;
  startTags: number;
  emptyTags: number;
  endTags: number;
  textNodes: number;
  attributes: number;
}

import fs, {type ReadStream} from "fs";
import {sax} from "./libs/sax.ts";
import {saxe} from "./libs/saxe.ts";
import {saxes} from "./libs/saxes.ts";

const promisify = (
  func: (
    readable: ReadStream,
    callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
    ignoreDtd?: boolean,
  ) => void,
) =>
(readable: ReadStream, ignoreDtd?: boolean) =>
  new Promise((resolve, reject) => {
    func(readable, (tokens, error) => {
      if (tokens === undefined) {
        reject(error);
      } else {
        resolve(tokens);
      }
    }, ignoreDtd);
  });

const pSax = promisify(sax);
const pSaxe = promisify(saxe);
const pSaxes = promisify(saxes);

async function runTestCaseSax(name: string, n: number) {
  console.log("sax", name);
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSax(readable);
    } catch (error) {
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxe(name: string, n: number) {
  console.log("saxe", name);
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxe(readable);
    } catch (error) {
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxe2(name: string, n: number) {
  console.log("saxe no dtd", name);
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxe(readable, true);
    } catch (error) {
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxes(name: string, n: number) {
  console.log("saxes", name);
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxes(readable);
    } catch (error) {
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

const DATASET = [
  "lolz.xml",
  "quadratic_blowup.xml",
  // "aaaaaa_attr.xml",
  // "aaaaaa_cdata.xml",
  // "aaaaaa_comment.xml",
  // "aaaaaa_tag.xml",
  // "aaaaaa_text.xml",
];

function out([time, isError]: readonly [number, boolean]) {
  return `${isError ? "✘" : "✔"} ${time.toFixed(3)}ms`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) { return "0 B"; }

  const k = 1000;
  const sizes = ["B", "kB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);

  return `${size} ${sizes[i]}`;
}

const writable = fs.createWriteStream("data.csv");
writable.write(
  "Test Case,Size,saxe,saxe no dtd,isaacs/sax-js,lddubeau/saxes\n",
);
const WARMUP = 5;
const N = 50;

for (const data of DATASET) {
  // warmup
  await runTestCaseSaxe("../test/data/" + data, WARMUP);
  const saxe = await runTestCaseSaxe("../test/data/" + data, N);
  // warmup
  await runTestCaseSaxe2("../test/data/" + data, WARMUP);
  const saxe2 = await runTestCaseSaxe2("../test/data/" + data, N);
  await runTestCaseSax("../test/data/" + data, WARMUP);
  const sax = await runTestCaseSax("../test/data/" + data, N);
  await runTestCaseSaxes("../test/data/" + data, WARMUP);
  const saxes = await runTestCaseSaxes("../test/data/" + data, N);
  writable.write(
    `${data},${formatBytes(fs.statSync("../test/data/" + data).size)},` +
      `${out(saxe)},${out(saxe2)},${out(sax)},${out(saxes)}\n`,
  );
}

const DATASET2 = [
  // "dblp.xml",
  "mondial-3.0.xml",
  "uwm.xml",
  "nasa.xml",
  "orders.xml",
  "part.xml",
  "supplier.xml",
  "lineitem.xml",
  "nation.xml",
  "customer.xml",
];
const N2 = 50;
for (const data of DATASET2) {
  await runTestCaseSaxe("./data/" + data, WARMUP);
  const saxe = await runTestCaseSaxe("./data/" + data, N2);
  await runTestCaseSaxe2("./data/" + data, WARMUP);
  const saxe2 = await runTestCaseSaxe2("./data/" + data, N2);
  await runTestCaseSax("./data/" + data, WARMUP);
  const sax = await runTestCaseSax("./data/" + data, N2);
  await runTestCaseSaxes("./data/" + data, WARMUP);
  const saxes = await runTestCaseSaxes("./data/" + data, N2);
  writable.write(
    `${data},${formatBytes(fs.statSync("./data/" + data).size)},` +
      `${out(saxe)},${out(saxe2)},${out(sax)},${out(saxes)}\n`,
  );
}
