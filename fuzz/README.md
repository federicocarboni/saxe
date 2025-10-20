# Fuzz testing a memory safe language like JavaScript?

Fuzz testing is a software testing technique used to find security and stability
issues by providing pseudo-random data as input to the software. It is usually
applied to non memory-safe languages like C/C++ which infamously suffer issues
such as segfaults. That said even memory safe language benefit from fuzz testing
because they can still suffer memory leaks, infinite loops, deadlocks and other
hangs, throw unexpected errors or, in a word, bugs.

## How we do it

To fuzz test JavaScript the library uses [jsfuzz from GitLab].

[jsfuzz from GitLab]:
https://gitlab.com/gitlab-org/security-products/analyzers/fuzzers/jsfuzz
