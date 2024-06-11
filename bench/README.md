# Benchmarks

These benchmarks are incomplete and pool from a severely limited number of runs.
Take with a grain of salt.

| Test Case              | Size      | saxe         | saxe dtd ignore | isaacs/sax-js | lddubeau/saxes | NaturalIntelligence/fast-xml-parser |
| ---------------------- | --------- | ------------ | --------------- | ------------- | -------------- | ----------------------------------- |
| lolz.xml[^1]           | 789 B     | ✘ 16.139ms   | ✔ 0.204ms       | ✔ 0.339ms     | ✔ 0.255ms      | ✔ 0.257ms                           |
| aaaaaa_attr.xml[^2]    | 10.00 MB  | ✔ 29.235ms   | ✔ 26.571ms      | ✔ 593.406ms   | ✔ 39.451ms     | ✔ 524.888ms                         |
| aaaaaa_cdata.xml[^3]   | 10.00 MB  | ✔ 14.075ms   | ✔ 13.499ms      | ✔ 580.090ms   | ✔ 29.784ms     | ✔ 9.212ms                           |
| aaaaaa_comment.xml[^4] | 10.00 MB  | ✔ 16.397ms   | ✔ 16.178ms      | ✔ 564.295ms   | ✔ 30.458ms     | ✔ 8.971ms                           |
| aaaaaa_tag.xml[^5]     | 10.00 MB  | ✔ 26.053ms   | ✔ 28.306ms      | ✔ 708.200ms   | ✔ 35.216ms     | ✔ 521.795ms                         |
| aaaaaa_text.xml[^6]    | 10.00 MB  | ✔ 27.307ms   | ✔ 26.093ms      | ✔ 36.419ms    | ✔ 32.507ms     | ✔ 524.837ms                         |
| dblp.xml               | 133.86 MB | ✔ 1069.940ms | ✔ 1077.963ms    | ✔ 3120.266ms  | ✔ 1013.489ms   |                                     |
| mondial-3.0.xml        | 1.50 MB   | ✔ 12.642ms   | ✔ 11.417ms      | ✔ 39.562ms    | ✔ 13.439ms     |                                     |
| nasa.xml               | 25.05 MB  | ✔ 181.515ms  | ✔ 186.862ms     | ✔ 474.099ms   | ✔ 177.603ms    |                                     |
| uwm.xml                | 2.25 MB   | ✔ 17.206ms   | ✔ 17.771ms      | ✔ 57.083ms    | ✔ 16.316ms     |                                     |

[^1]: Billion laughs attack. Proper entity expansion would occupy more than 3 GB
  of memory.
[^2]: Trivial file with an attribute value 10MB long.
[^3]: Trivial file with a CDATA section 10MB long.
[^4]: Trivial file with a comment 10MB long.
[^5]: Trivial file with a tag name 10MB long.
[^6]: Trivial file with a text node 10MB long.
