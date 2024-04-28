// To reduce code size the internal subset is handled synchronously in a single
// pass.

import {Chars, isNameChar, isNameStartChar, isWhitespace} from "./chars.ts";
import {createSaxError} from "./error.ts";

// Being internal symbols all fields in this module are mangled.

// @internal
export interface AttDef {
  // Default value if any
  default_: string | undefined;
  isCdata_: boolean;
}

// @internal
export class InternalSubset {
  private symbolTable_ = new Map<string, string | undefined>();
  // private generalEntities_ = new Map<string, string>();
  private index_ = 0;
  // After an external parameter entity reference declarations must be ignored
  // As external entities are not processed.
  // @internal
  // private seenExternalParamEntity_ = false;
  // private attlistDecls_ = new Map<string, Map<string, string>>();

  // Entities declared in the internal subset, external entities are ignored.
  entities_ = new Map<string, string>();
  // Attlist declarations, each element for which is declared a default
  //
  attlists_ = new Map<string, Map<string, AttDef>>();

  constructor(private input_: string) {
    this.parse_();
  }

  private parse_() {
    while (this.index_ < this.input_.length) {
      const codeUnit = this.input_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.LT: {
          const codeUnit = this.input_.charCodeAt(this.index_ + 1);
          if (codeUnit === Chars.BANG) {
            switch (this.input_.charCodeAt(this.index_ + 2)) {
              case Chars.HYPHEN:
                if (this.input_.charCodeAt(this.index_ + 3) === Chars.HYPHEN) {
                  //
                }
                break
              case Chars.UPPER_A:
                this.parseAttlistDecl_();
                break;
              case Chars.UPPER_E:
                if (this.input_.charCodeAt(this.index_ + 3) === Chars.UPPER_N) {
                  this.parseEntityDecl_();
                } else {
                  this.parseElementDecl_();
                }
                break;
              case Chars.UPPER_N:
                this.parseNotationDecl_();
                break;
            }
          } else if (codeUnit === Chars.QUESTION) {
            const end = this.input_.indexOf("?>", this.index_);
            if (end) {
              throw createSaxError("INVALID_INTERNAL_SUBSET");
            }
            this.index_ = end + 2;
          }
          break;
        }
        case Chars.PERCENT: {
          const entity = this.parseParameterEntityReference_();
          if (!this.symbolTable_.has(entity)) {
            // this.seenExternalParamEntity_ = true;
          } else {
            const input = this.input_;
            const index = this.index_;
            this.index_ = 0;
            this.input_ = this.symbolTable_.get(entity)!;
            this.parse_();
            this.index_ = index;
            this.input_ = input;
          }
          break;
        }
        default:
          if (!isWhitespace(codeUnit)) {
            throw createSaxError("INVALID_INTERNAL_SUBSET");
          }
      }
    }
  }

  private parseAttlistDecl_() {}
  private parseElementDecl_() {
  }
  private parseEntityDecl_() {
  }
  private parseNotationDecl_() {}

  private parseParameterEntityReference_() {
    const start = this.index_;
    const codePoint = this.input_.codePointAt(this.index_)!;
    ++this.index_;
    if (codePoint > 0xFFFF) {
      ++this.index_;
    }
    if (!isNameStartChar(codePoint)) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
    }
    while (this.index_ < this.input_.length) {
      const codePoint = this.input_.codePointAt(this.index_)!;
      ++this.index_;
      if (codePoint > 0xFFFF) {
        ++this.index_;
      }
      if (!isNameChar(codePoint)) {
        break;
      }
    }
    if (this.input_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
    }
    ++this.index_;
    return this.input_.slice(start, this.index_);
  }
}
