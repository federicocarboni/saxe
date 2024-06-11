// This benchmark also measures startup time

export interface ReadTokens {
  comments: number;
  processingInstructions: number;
  startTags: number;
  emptyTags: number;
  endTags: number;
  textNodes: number;
}

import fs, { type ReadStream } from "fs";
import { sax } from "./libs/sax.ts";
import { saxe } from "./libs/saxe.ts";
import { saxes } from "./libs/saxes.ts";
import { fast_xml_parser } from "./libs/fast-xml-parser.ts";

const promisify =
  (
    func: (
      readable: ReadStream,
      callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
      ignoreDtd?: boolean
    ) => void
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
const pFastXmlParser = promisify(fast_xml_parser);

async function runTestCaseSax(name: string, n: number) {
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSax(readable);
    } catch (error) {
      console.error("sax", error);
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxe(name: string, n: number) {
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxe(readable);
    } catch (error) {
      // console.error("saxe", error);
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxe2(name: string, n: number) {
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxe(readable, true);
    } catch (error) {
      // console.error("saxe", error);
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseSaxes(name: string, n: number) {
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pSaxes(readable);
    } catch (error) {
      // console.error("saxes", error);
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

async function runTestCaseFastXmlParser(name: string, n: number) {
  let isError = false;
  let all = 0;
  for (let i = 0; i < n; ++i) {
    const readable = fs.createReadStream(name, "utf-8");
    const start = performance.now();
    try {
      await pFastXmlParser(readable);
    } catch (error) {
      console.error("fastXmlParser", error);
      isError = true;
    }
    all += performance.now() - start;
  }
  return [all / n, isError] as const;
}

const DATASET = [
  "lolz.xml",
  // "quadratic_blowup.xml",
  "aaaaaa_attr.xml",
  "aaaaaa_cdata.xml",
  "aaaaaa_comment.xml",
  "aaaaaa_tag.xml",
  "aaaaaa_text.xml",
];

function out([time, isError]: readonly [number, boolean]) {
  return `${isError ? "✘" : "✔"} ${time.toFixed(3)}ms`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const k = 1000;
  const sizes = ["B", "kB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);

  return `${size} ${sizes[i]}`;
}

const writable = fs.createWriteStream("data.csv");
writable.write(
  "Test Case,Size,saxe,saxe no dtd,isaacs/sax-js,lddubeau/saxes,NaturalIntelligence/fast-xml-parser\n"
);
const N = 10;
for (const data of DATASET) {
  const saxe = await runTestCaseSaxe("../test/data/" + data, N);
  const saxe2 = await runTestCaseSaxe2("../test/data/" + data, N);
  const sax = await runTestCaseSax("../test/data/" + data, N);
  const saxes = await runTestCaseSaxes("../test/data/" + data, N);
  const fastXmlParser = await runTestCaseFastXmlParser(
    "../test/data/" + data,
    N
  );
  writable.write(
    `${data},${formatBytes(fs.statSync("../test/data/" + data).size)},${out(
      saxe
    )},${out(saxe2)},${out(sax)},${out(saxes)},${out(fastXmlParser)}\n`
  );
}

const DATASET2 = [
  "dblp.xml",
  "mondial-3.0.xml",
  "nasa.xml",
  "uwm.xml",
  "JMdict",
];
const N2 = 5;
for (const data of DATASET2) {
  const saxe = await runTestCaseSaxe("./data/" + data, N2);
  const saxe2 = await runTestCaseSaxe2("./data/" + data, N2);
  const sax = await runTestCaseSax("./data/" + data, N2);
  const saxes = await runTestCaseSaxes("./data/" + data, N2);
  // const fastXmlParser = await runTestCaseFastXmlParser("./data/" + data, N2);
  // ,${fastXmlParser.join(" ")}
  writable.write(
    `${data},${formatBytes(fs.statSync("./data/" + data).size)},${out(
      saxe
    )},${out(saxe2)},${out(sax)},${out(saxes)},\n`
  );
}
