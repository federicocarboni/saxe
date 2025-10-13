# Benchmarks

Benchmark results compared to [isaacs/sax-js] and [lddubeau/saxes]. Fast XML
parser was removed because it is unfair to compare full deserialization to SAX
event driven parsing.

| Test Case | Size | saxe | saxe (dtd ignore) | isaacs/sax-js | lddubeau/saxes |
|---|---|---|---|---|---|
| lolz.xml[^1] | 789 B | ✘ 14.031ms[^3] | ✔ 0.069ms | ✔ 0.207ms | ✔ 0.078ms |
| quadratic_blowup.xml[^2] | 400.07 kB | ✘ 33.846ms[^3] | ✔ 4.902ms | ✔ 30.343ms | ✔ 4.355ms |
| aaaaaa_attr.xml[^4] | 10.00 MB | ✔ 33.543ms | ✔ 33.458ms | ✔ 492.710ms | ✔ 30.534ms |
| aaaaaa_cdata.xml[^5] | 10.00 MB | ✔ 12.770ms | ✔ 12.201ms | ✔ 457.582ms | ✔ 26.624ms |
| aaaaaa_comment.xml[^6] | 10.00 MB | ✔ 12.632ms | ✔ 12.673ms | ✔ 453.909ms | ✔ 26.275ms |
| aaaaaa_tag.xml[^7] | 10.00 MB | ✔ 27.163ms | ✔ 25.972ms | ✔ 597.353ms | ✔ 31.702ms |
| aaaaaa_text.xml[^8] | 10.00 MB | ✔ 37.314ms | ✔ 36.176ms | ✔ 28.777ms | ✔ 27.847ms |
| dblp.xml | 133.86 MB | ✔ 986.707ms | ✔ 985.973ms | ✔ 2932.423ms | ✔ 944.626ms |
| mondial-3.0.xml | 1.50 MB | ✔ 10.666ms | ✔ 10.515ms | ✔ 33.419ms | ✔ 12.636ms |
| uwm.xml | 2.25 MB | ✔ 14.858ms | ✔ 14.725ms | ✔ 53.995ms | ✔ 14.558ms |
| nasa.xml | 25.05 MB | ✔ 155.870ms | ✔ 152.855ms | ✔ 452.968ms | ✔ 159.672ms |
| orders.xml | 5.38 MB | ✔ 41.860ms | ✔ 42.151ms | ✔ 140.586ms | ✔ 33.275ms |
| part.xml | 618.18 kB | ✔ 4.702ms | ✔ 4.821ms | ✔ 14.816ms | ✔ 3.815ms |
| supplier.xml | 29.25 kB | ✔ 0.260ms | ✔ 0.285ms | ✔ 0.643ms | ✔ 0.190ms |
| lineitem.xml | 32.30 MB | ✔ 265.785ms | ✔ 265.544ms | ✔ 947.823ms | ✔ 219.569ms |
| nation.xml | 4.58 kB | ✔ 0.058ms | ✔ 0.061ms | ✔ 0.137ms | ✔ 0.056ms |
| customer.xml | 515.66 kB | ✔ 3.501ms | ✔ 3.436ms | ✔ 10.537ms | ✔ 2.915ms |

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
