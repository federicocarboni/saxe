# Benchmarks

This directory contains all sources necessary to benchmark saxe and the similar
libraries [isaacs/sax-js] and [lddubeau/saxes].

These benchmarks are not definitive proof of performance for your specific use
case. They are intended to validate the general performance characteristics of
each implementation in different conditions.

Data reported below is only indicative and is not as accurate as it could be.
Last run on 15/11/2025:

- saxe git-b376dfc
- [isaacs/sax-js] v1.4.2
- [lddubeau/saxes] v6.0.0


## Attack Payloads

Malicious inputs exploiting entity expansion, which only saxe implements.
[isaacs/sax-js] and [lddubeau/saxes] skip the internal DTD subset, so they are
more comparable to saxe when it is configured to ignore it.

| File                     | Size      | saxe         | saxe (DTD ignore) | [isaacs/sax-js] | [lddubeau/saxes] |
|--------------------------|-----------|--------------|-------------------|-----------------|------------------|
| lolz.xml[^1]             | 789 B     | 13.37 ms[^3] | 32.22 µs          | 33.16 µs        | 27.05 µs         |
| quadratic_blowup.xml[^2] | 400.07 kB | 34.64 ms[^3] | 5.35 ms           | 30.78 ms        | 4.44 ms          |

<small>node 22.18.0 (x64-linux)</small>

| File                     | Size      | saxe         | saxe (DTD ignore) | [isaacs/sax-js] | [lddubeau/saxes] |
|--------------------------|-----------|--------------|-------------------|-----------------|------------------|
| lolz.xml[^1]             | 789 B     | 18.95 ms[^3] | 37.08 µs          | 39.83 µs        | 31.83 µs         |
| quadratic_blowup.xml[^2] | 400.07 kB | 12.34 ms[^3] | 7.89 ms           | 16.86 ms        | 3.58 ms          |

<small>bun 1.3.1 (x64-linux)</small>


## Synthetic Files

Larger files with a monotonous structure to stress specific parts of the parsing
steps.

| File                   | Size  | saxe     | [isaacs/sax-js] | [lddubeau/saxes] |
|------------------------|-------|----------|-----------------|------------------|
| aaaaaa_attr.xml[^4]    | 10 MB | 35.85 ms | 515.32 ms       | 29.42 ms         |
| aaaaaa_cdata.xml[^5]   | 10 MB | 11.72 ms | 45.78 ms        | 26.54 ms         |
| aaaaaa_comment.xml[^6] | 10 MB | 12.69 ms | 495.55 ms       | 36.82 ms         |
| aaaaaa_tag.xml[^7]     | 10 MB | 24.30 ms | 620.98 ms       | 41.06 ms         |
| aaaaaa_text.xml[^8]    | 10 MB | 36.83 ms | 45.91 ms        | 37.28 ms         |

<small>node 22.18.0 (x64-linux)</small>

| File                   | Size  | saxe     | [isaacs/sax-js] | [lddubeau/saxes] |
|------------------------|-------|----------|-----------------|------------------|
| aaaaaa_attr.xml[^4]    | 10 MB | 18.59 ms | 220.95 ms       | 22.54 ms         |
| aaaaaa_cdata.xml[^5]   | 10 MB | 10.40 ms | 136.93 ms       | 19.55 ms         |
| aaaaaa_comment.xml[^6] | 10 MB | 10.41 ms | 198.71 ms       | 47.47 ms         |
| aaaaaa_tag.xml[^7]     | 10 MB | 62.01 ms | 294.76 ms       | 129.29 ms        |
| aaaaaa_text.xml[^8]    | 10 MB | 18.97 ms | 143.42 ms       | 86.09 ms         |

<small>bun 1.3.1 (x64-linux)</small>


### Synthetic Files in Namespace mode

| File                   | Size  | saxe     | [isaacs/sax-js] | [lddubeau/saxes] |
|------------------------|-------|----------|-----------------|------------------|
| aaaaaa_attr.xml[^4]    | 10 MB | 33.59 ms | 529.01 ms       | 48.99 ms         |
| aaaaaa_cdata.xml[^5]   | 10 MB | 11.77 ms | 65.69 ms        | 43.52 ms         |
| aaaaaa_comment.xml[^6] | 10 MB | 12.10 ms | 498.15 ms       | 43.74 ms         |
| aaaaaa_tag.xml[^7]     | 10 MB | 27.57 ms | 638.02 ms       | 50.76 ms         |
| aaaaaa_text.xml[^8]    | 10 MB | 35.62 ms | 62.82 ms        | 45.24 ms         |

<small>node 22.18.0 (x64-linux)</small>

| File                   | Size  | saxe     | [isaacs/sax-js] | [lddubeau/saxes] |
|------------------------|-------|----------|-----------------|------------------|
| aaaaaa_attr.xml[^4]    | 10 MB | 19.49 ms | 277.02 ms       | 21.08 ms         |
| aaaaaa_cdata.xml[^5]   | 10 MB | 15.28 ms | 81.02 ms        | 43.24 ms         |
| aaaaaa_comment.xml[^6] | 10 MB | 17.63 ms | 238.88 ms       | 43.57 ms         |
| aaaaaa_tag.xml[^7]     | 10 MB | 64.17 ms | 296.02 ms       | 138.57 ms        |
| aaaaaa_text.xml[^8]    | 10 MB | 18.98 ms | 180.48 ms       | 57.78 ms         |

<small>bun 1.3.1 (x64-linux)</small>


## Real Data

Sample files from the
[UW XML Data Repository](https://aiweb.cs.washington.edu/research/projects/xmltk/xmldata/).

| Benchmark | Size | saxe | [isaacs/sax-js] | [lddubeau/saxes] |
|---|---|---|---|---|
| dblp.xml | 133.86 MB | 1.11 s | 5.06 s | 1.29 s |
| mondial-3.0.xml | 1.50 MB | 11.77 ms | 58.23 ms | 16.82 ms |
| uwm.xml | 2.25 MB | 17.25 ms | 93.65 ms | 20.52 ms |
| nasa.xml | 25.05 MB | 174.53 ms | 846.31 ms | 221.35 ms |
| orders.xml | 5.38 MB | 44.63 ms | 232.85 ms | 46.65 ms |
| part.xml | 618.18 kB | 5.10 ms | 25.34 ms | 5.50 ms |
| supplier.xml | 29.25 kB | 257.50 µs | 1.14 ms | 259.93 µs |
| lineitem.xml | 32.30 MB | 280.91 ms | 1.50 s | 296.66 ms |
| nation.xml | 4.58 kB | 55.16 µs | 202.97 µs | 58.49 µs |
| customer.xml | 515.66 kB | 3.74 ms | 18.78 ms | 4.16 ms |

<small>node 22.18.0 (x64-linux)</small>

| Benchmark | Size | saxe | [isaacs/sax-js] | [lddubeau/saxes] |
|---|---|---|---|---|
| dblp.xml | 133.86 MB | 1.60 s | 7.35 s | 2.20 s |
| mondial-3.0.xml | 1.50 MB | 20.30 ms | 106.95 ms | 33.21 ms |
| uwm.xml | 2.25 MB | 30.81 ms | 138.12 ms | 47.34 ms |
| nasa.xml | 25.05 MB | 270.42 ms | 1.15 s | 490.21 ms |
| orders.xml | 5.38 MB | 72.64 ms | 169.88 ms | 114.18 ms |
| part.xml | 618.18 kB | 9.11 ms | 18.92 ms | 13.66 ms |
| supplier.xml | 29.25 kB | 416.72 µs | 656.20 µs | 490.79 µs |
| lineitem.xml | 32.30 MB | 483.84 ms | 845.73 ms | 667.87 ms |
| nation.xml | 4.58 kB | 81.73 µs | 124.21 µs | 118.52 µs |
| customer.xml | 515.66 kB | 6.23 ms | 10.81 ms | 9.87 ms |

<small>bun 1.3.1 (x64-linux)</small>


### Real Data in Namespace mode

| Benchmark | Size | saxe | [isaacs/sax-js] | [lddubeau/saxes] |
|---|---|---|---|---|
| dblp.xml | 133.86 MB | 1.39 s | 5.80 s | 1.62 s |
| mondial-3.0.xml | 1.50 MB | 17.14 ms | 65.37 ms | 21.73 ms |
| uwm.xml | 2.25 MB | 24.14 ms | 105.74 ms | 27.17 ms |
| nasa.xml | 25.05 MB | 229.92 ms | 965.02 ms | 291.67 ms |
| orders.xml | 5.38 MB | 58.92 ms | 264.21 ms | 61.72 ms |
| part.xml | 618.18 kB | 6.92 ms | 29.11 ms | 7.09 ms |
| supplier.xml | 29.25 kB | 348.63 µs | 1.29 ms | 353.44 µs |
| lineitem.xml | 32.30 MB | 380.47 ms | 1.70 s | 389.85 ms |
| nation.xml | 4.58 kB | 70.70 µs | 235.18 µs | 73.33 µs |
| customer.xml | 515.66 kB | 4.90 ms | 21.77 ms | 5.56 ms |

<small>node 22.18.0 (x64-linux)</small>

| Benchmark | Size | saxe | [isaacs/sax-js] | [lddubeau/saxes] |
|---|---|---|---|---|
| dblp.xml | 133.86 MB | 2.08 s | 9.00 s | 2.43 s |
| mondial-3.0.xml | 1.50 MB | 27.81 ms | 125.28 ms | 32.84 ms |
| uwm.xml | 2.25 MB | 39.07 ms | 161.76 ms | 43.97 ms |
| nasa.xml | 25.05 MB | 359.97 ms | 1.48 s | 468.75 ms |
| orders.xml | 5.38 MB | 97.48 ms | 445.69 ms | 98.88 ms |
| part.xml | 618.18 kB | 12.35 ms | 17.88 ms | 12.06 ms |
| supplier.xml | 29.25 kB | 537.65 µs | 765.12 µs | 542.27 µs |
| lineitem.xml | 32.30 MB | 648.84 ms | 993.38 ms | 587.69 ms |
| nation.xml | 4.58 kB | 104.95 µs | 143.15 µs | 105.33 µs |
| customer.xml | 515.66 kB | 8.45 ms | 12.96 ms | 8.93 ms |

<small>bun 1.3.1 (x64-linux)</small>

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
