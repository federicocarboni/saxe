// This benchmark also measures startup time

export interface ReadTokens {
  comments: number;
  processingInstructions: number;
  startTags: number;
  endTags: number;
  textNodes: number;
  attributes: number;
}
import {summary, bench, run} from "mitata";

import type {ReadStream} from "fs";
import fs from "fs";
import {SaxError} from "../src/error.ts";
import {SaxOptions} from "../src/parser.ts";
import {sax} from "./libs/sax.ts";
import {saxe} from "./libs/saxe.ts";
import {saxes} from "./libs/saxes.ts";

export interface BenchOptions {
  dtd?: SaxOptions["dtd"];
  namespaces?: boolean | undefined;
}

const promisify = (
  func: (
    readable: ReadStream,
    callback: (tokens: ReadTokens | undefined, error?: unknown) => void,
    options?: BenchOptions,
  ) => void,
) =>
(readable: ReadStream, options?: BenchOptions) =>
  new Promise((resolve, reject) => {
    func(readable, (tokens, error) => {
      if (tokens === undefined) {
        reject(error);
      } else {
        resolve(tokens);
      }
    }, options);
  });

const pSax = promisify(sax);
const pSaxe = promisify(saxe);
const pSaxes = promisify(saxes);

async function runTestCaseSaxe(name: string, options?: BenchOptions) {
  const readable = fs.createReadStream(name, "utf-8");
  return await pSaxe(readable, options);
}
async function runTestCaseSax(name: string, options?: BenchOptions) {
  const readable = fs.createReadStream(name, "utf-8");
  return await pSax(readable, options);
}
async function runTestCaseSaxes(name: string, options?: BenchOptions) {
  const readable = fs.createReadStream(name, "utf-8");
  return await pSaxes(readable, options);
}
const ATTACKS = [
  "lolz.xml",
  "quadratic_blowup.xml",
];

for (const testCase of ATTACKS) {
  summary(() => {
    bench("saxe " + testCase, function*() {
      yield async () => {
        try {
          return await runTestCaseSaxe("../test/data/" + testCase);
        } catch (error) {
          if (!(error instanceof SaxError)) {
            throw error;
          }
        }
      };
    });
    bench("saxe (dtd ignore) " + testCase, function*() {
      yield () => runTestCaseSaxe("../test/data/" + testCase, {dtd: "ignore"});
    });
    bench("sax " + testCase, function*() {
      yield () => runTestCaseSax("../test/data/" + testCase);
    });
    bench("saxes " + testCase, function*() {
      yield () => runTestCaseSaxes("../test/data/" + testCase);
    });
  });
}

const SYNTHETIC = [
  "aaaaaa_attr.xml",
  "aaaaaa_cdata.xml",
  "aaaaaa_comment.xml",
  "aaaaaa_tag.xml",
  "aaaaaa_text.xml",
];

for (const testCase of SYNTHETIC) {
  summary(() => {
    bench("saxe " + testCase, function*() {
      yield () => runTestCaseSaxe("../test/data/" + testCase);
    });
    bench("sax " + testCase, function*() {
      yield () => runTestCaseSax("../test/data/" + testCase);
    });
    bench("saxes " + testCase, function*() {
      yield () => runTestCaseSaxes("../test/data/" + testCase);
    });
  });
  summary(() => {
    bench("saxe (ns) " + testCase, function*() {
      yield () => runTestCaseSaxe("../test/data/" + testCase, {namespaces: true});
    });
    bench("sax (ns) " + testCase, function*() {
      yield () => runTestCaseSax("../test/data/" + testCase, {namespaces: true});
    });
    bench("saxes (ns) " + testCase, function*() {
      yield () => runTestCaseSaxes("../test/data/" + testCase, {namespaces: true});
    });
  });
}


const TEST_CASES = [
  "dblp.xml",
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

for (const testCase of TEST_CASES) {
  summary(() => {
    bench("saxe " + testCase, function*() {
      yield () => runTestCaseSaxe("data/" + testCase);
    });
    bench("sax " + testCase, function*() {
      yield () => runTestCaseSax("data/" + testCase);
    });
    bench("saxes " + testCase, function*() {
      yield () => runTestCaseSaxes("data/" + testCase);
    });
  });
  summary(() => {
    bench("saxe (ns) " + testCase, function*() {
      yield () => runTestCaseSaxe("data/" + testCase, {namespaces: true});
    });
    bench("sax (ns) " + testCase, function*() {
      yield () => runTestCaseSax("data/" + testCase, {namespaces: true});
    });
    bench("saxes (ns) " + testCase, function*() {
      yield () => runTestCaseSaxes("data/" + testCase, {namespaces: true});
    });
  });
}

await run({
  format: {
    json: {
      debug: false,
      samples: false,
    },
  },
  // format: "markdown"
});
