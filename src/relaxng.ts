import {SaxParser, SaxReader} from "./index.ts";

// @internal
const enum PatternType {
  NONE = 0,
  ELEMENT,
  ATTRIBUTE,
  GROUP,
  INTERLEAVE,
  CHOICE,
  OPTIONAL,
  ZERO_OR_MORE,
  ONE_OR_MORE,
  LIST,
  MIXED,
  REF,
  PARENT_REF,
  EMPTY,
  TEXT,
  VALUE,
  DATA,
  NOT_ALLOWED,
  EXTERNAL_REF,
  GRAMMAR,
}

// @internal
interface Pattern {
  type_: PatternType;
  name_: string | undefined;
  children_: Pattern[] | undefined;
}

// @internal
class SchemaReader implements SaxReader {
  private defines_ = new Map<string, Pattern>();
  private pattern_: Pattern | undefined = undefined;

  start(name: string, attributes: ReadonlyMap<string, string>): void {
    void name;
    void attributes;
    void this.defines_;
    void this.pattern_;
    throw new Error("Method not implemented.");
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    this.start(name, attributes);
    this.end(name);
  }
  end(name: string): void {
    void name;
    throw new Error("Method not implemented.");
  }
  text(text: string): void {
    void text;
    throw new Error("Method not implemented.");
  }
}

export class RelaxngSchema {
  static parse(input: string): RelaxngSchema {
    const reader = new SchemaReader();
    const parser = new SaxParser(reader);
    parser.write(input);
    parser.end();
    return new RelaxngSchema();
  }
}

export function element() {}

export class RelaxngValidator implements SaxReader {
  // @internal
  private reader_: SaxReader;

  constructor(reader: SaxReader, schema: RelaxngSchema) {
    this.reader_ = reader;
    void this.reader_;
    void schema;
  }

  // xml?(declaration: XmlDeclaration): void {
  //   throw new Error("Method not implemented.");
  // }
  // doctype?(doctype: Doctype): void {
  //   throw new Error("Method not implemented.");
  // }
  // processingInstruction?(target: string, content: string): void {
  //   throw new Error("Method not implemented.");
  // }
  // comment?(text: string): void {
  //   throw new Error("Method not implemented.");
  // }
  // getGeneralEntity?(entityName: string): string | undefined {
  //   throw new Error("Method not implemented.");
  // }
  // entityRef?(entityName: string): void {
  //   throw new Error("Method not implemented.");
  // }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    void name;
    void attributes;
    throw new Error("Method not implemented.");
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    void name;
    void attributes;
    throw new Error("Method not implemented.");
  }
  end(name: string): void {
    void name;
    throw new Error("Method not implemented.");
  }
  text(text: string): void {
    void text;
    throw new Error("Method not implemented.");
  }
}
