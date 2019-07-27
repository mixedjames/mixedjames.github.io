---
layout: post
title: R tips - Everything is a Vector
tags: hide-strapline
---

Stuff I wish I knew when I started.

To quote [Raymond Chen](https://devblogs.microsoft.com/oldnewthing/), lots of things here a “true enough” rather than necessarily strictly accurate by the letter of the spec. Your mileage may vary but I find I remember my intuition about how something works but however carefully I’ve learned a precise definition or specification I always need to look it up.

# The Short Version...

Everything is a vector

: Even stuff that looks scalar is just using single-element vectors; operators produce vectors whose length is the length of the longest input; short vectors are extended by repitition

Most basic operations take the following form:

: `resultVector <- aVector operand bVector`

If you want a combining or summary result, you need to spell that out explicitly

: *i.e. sum(a + b) or max(a + b) etc.*

# The Long Version...

Obviously this isn’t actually true - not **everything** is a vector - R has loads of data types including user-defined types. But the point is this:

**You get most from R when you remember that most operations act on a set/list/sequence of elements, even when they look scalar.**

```R
a <- c(1,2,3,4,5,6,7,8,9,10)
b <- c(10,9,8,7,6,5,4,3,2,1)

a + b  # Add them
a - b  # Subtract them
a^2    # Square one of them

# Outputs...
[1] 11 11 11 11 11 11 11 11 11 11
[1] -9 -7 -5 -3 -1  1  3  5  7  9
[1]   1   4   9  16  25  36  49  64  81 100
```

Ok, the above examples are pretty obvious. But, a couple of other rules start to make things more interesting...

1. When 2 vectors aren’t the same length, the shorter one is repeated until they are equal (but only if the shorter one’s length is a factor of the longer one)
2. Most operators produce vectors of the same length as the longest input

```R
a * c(1,2)  # Multiplies elements 2,4,6,8,10 by 2, and 1,3,5,7,9 by 1
a <= 5      # Tests each element to see if it's less than or equal to 5

# Outputs...
[1]  1  4  3  8  5 12  7 16  9 20
[1]  TRUE  TRUE  TRUE  TRUE  TRUE FALSE FALSE FALSE FALSE FALSE
```

The latter example is why this doesn’t work for counting elements...

```R
length(a <= 5)
[1] 10
```

But this does...

```R
sum(a <= 5)
[1] 5
```

(Sum converts TRUE to 1, and FALSE to 0, so it effectively just counts the TRUEs)

## Thoughts on multiplying vectors...

Multiplying vectors is worth a little extra thought - in R it works slightly differently to how you might expect from a maths point of view.

Here’s a quick summary:

```R
# Two 3-component vectors for us to use
a <- 1:3
b <- 4:6
```

| Operation | Result      | What is actually does...                                     |
| --------- | ----------- | ------------------------------------------------------------ |
| `a * 3`   | `[3,6,9]`   | Multiplies the components of `a` by a scalar giving another, *scaled*, vector. |
| `a * b`   | `[4,10,18]` | Multiples the components of `a` and `b` giving another vector |
| `a %*% b` | `[32]`      | There are two interpretations on what is going on here: (*although they’re both equivalent*):<br />1. Takes the dot product (*scalar product*) of two vectors<br />2. Treats `a` and `b` as matrices and multiplies them (implictly taking the first as a row-vector and the second as a column vector) |

The **cross product** is notable for it’s absence - R doesn’t provide a default implementation of this so, if you need it, you have to define it yourself.

