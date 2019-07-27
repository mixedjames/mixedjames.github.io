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

# The Long Version...

Obviously this isn’t actually true - R has loads of data types including user-defined types. But the point is this:

**You get most from R when you remember that most operations act on a set/list/sequence of elements, even when they look scalar.**

```{r}
a <- 1:10; # 10-element vector; values: 1 to 10
b <- 10:1; # 10-element vector; values: 10 to 1

# Add them
a + b
[1] 11 11 11 11 11 11 11 11 11 11

# Subtract them
a - b
[1] -9 -7 -5 -3 -1  1  3  5  7  9

# Square one of them
a^2
[1]   1   4   9  16  25  36  49  64  81 100
```

Ok, the above examples are pretty obvious. But, a couple of other rules start to make things more interesting...

1. When 2 vectors aren’t the same length, the shorter one is repeated until they are equal (but only if the shorter one’s length is a factor of the longer one)
2. Most operators produce vectors of the same length as the longest input

```{r}
# Multiplies elements 2,4,6,8,10 by 2, and 1,3,5,7,9 by 1
a * c(1,2)
[1]  1  4  3  8  5 12  7 16  9 20

# Tests each element to see if it's less than or equal to 5
a <= 5
[1]  TRUE  TRUE  TRUE  TRUE  TRUE FALSE FALSE FALSE FALSE FALSE
```

The latter example is why this doesn’t work for counting elements...

```{r}
length(a <= 5)
[1] 10
```

But this does...

```{r}
sum(a <= 5)
[1] 5
```

(Sum converts TRUE to 1, and FALSE to 0, so it effectively just counts the TRUEs)

## Thoughts on multiplying vectors...