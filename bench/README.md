# Benchmarks

Benchmark results compared to [isaacs/sax-js] and [lddubeau/saxes]. Fast XML
parser was removed because it is unfair to compare full deserialization to SAX
event driven parsing.

| Test Case | Size | saxe | saxe (dtd ignore) | isaacs/sax-js | lddubeau/saxes |
|---|---|---|---|---|---|
| lolz.xml[^1] | 789 B | ✘ 13.479ms[^3] | ✔ 0.071ms | ✔ 0.167ms | ✔ 0.087ms |
| quadratic_blowup.xml[^2] | 400.07 kB | ✘ 34.010ms[^3] | ✔ 15.544ms | ✔ 12.590ms | ✔ 4.409ms |
| aaaaaa_attr.xml[^4] | 10.00 MB | ✔ 32.977ms | ✔ 33.390ms | ✔ 492.669ms | ✔ 30.243ms |
| aaaaaa_cdata.xml[^5] | 10.00 MB | ✔ 11.158ms | ✔ 12.254ms | ✔ 460.163ms | ✔ 24.992ms |
| aaaaaa_comment.xml[^6] | 10.00 MB | ✔ 11.737ms | ✔ 11.764ms | ✔ 455.930ms | ✔ 27.673ms |
| aaaaaa_tag.xml[^7] | 10.00 MB | ✔ 25.704ms | ✔ 23.885ms | ✔ 577.255ms | ✔ 31.123ms |
| aaaaaa_text.xml[^8] | 10.00 MB | ✔ 35.580ms | ✔ 36.026ms | ✔ 27.799ms | ✔ 27.487ms |
| dblp.xml | 133.86 MB | ✔ 1014.746ms | ✔ 1008.567ms | ✔ 2865.265ms | ✔ 947.614ms |
| mondial-3.0.xml | 1.50 MB | ✔ 10.307ms | ✔ 10.381ms | ✔ 31.676ms | ✔ 12.276ms |
| uwm.xml | 2.25 MB | ✔ 14.699ms | ✔ 14.692ms | ✔ 52.479ms | ✔ 14.450ms |
| nasa.xml | 25.05 MB | ✔ 154.077ms | ✔ 152.122ms | ✔ 437.002ms | ✔ 159.048ms |
| orders.xml | 5.38 MB | ✔ 41.097ms | ✔ 41.132ms | ✔ 138.116ms | ✔ 32.787ms |
| part.xml | 618.18 kB | ✔ 4.580ms | ✔ 4.480ms | ✔ 14.261ms | ✔ 3.815ms |
| supplier.xml | 29.25 kB | ✔ 0.243ms | ✔ 0.311ms | ✔ 0.641ms | ✔ 0.195ms |
| lineitem.xml | 32.30 MB | ✔ 264.139ms | ✔ 262.961ms | ✔ 932.846ms | ✔ 217.816ms |
| nation.xml | 4.58 kB | ✔ 0.063ms | ✔ 0.054ms | ✔ 0.207ms | ✔ 0.124ms |
| customer.xml | 515.66 kB | ✔ 3.488ms | ✔ 3.461ms | ✔ 10.152ms | ✔ 2.911ms |

These values were the result of running the benchmark on
- Node v22.18.0
- OS: Ubuntu 24.04.3 LTS
- CPU: 12th Gen Intel i9-12900KF
- RAM: 64GB DDR4-3600

These benchmarks are incomplete and pool from a limited number of runs. Take
with a grain of salt.

[isaacs/sax-js]: https://github.com/isaacs/sax-js
[lddubeau/saxes]: https://github.com/lddubeau/saxes

[^1]: Billion laughs attack. Proper entity expansion would occupy more than 3 GB
  of memory.
[^2]: Quadratic blowup attack.
[^3]: Attack payload uses entity expansion which is not implemented in the other
  parsers. Time indicates how long the parser took before bailing with a limit
  exceeded. Entity expansion limits were left on default values.
[^4]: Trivial file with an attribute value 10MB long.
[^5]: Trivial file with a CDATA section 10MB long.
[^6]: Trivial file with a comment 10MB long.
[^7]: Trivial file with a tag name 10MB long.
[^8]: Trivial file with a text node 10MB long.
