---
layout: post
title: R tips - The Index Operator is Your Friend
tags: hide-strapline
---

Stuff I wish I knew when I started.

To quote [Raymond Chen](https://devblogs.microsoft.com/oldnewthing/), lots of things here a “true enough” rather than necessarily strictly accurate by the letter of the spec. Your mileage may vary but I find I remember my intuition about how something works but however carefully I’ve learned a precise definition or specification I always need to look it up.

# The Short Version...

The index (or filter) operator is your friend

: The index operator - square brackets - is a simple and fat-free way to get a vector that only contains a subset of another (bigger) vector. You just give it a vector that says which elements you want to keep.

# The Long Version...



Since most operators produce new vectors that are the same length as the longest vector you put it, how do you strip out elements you don’t want?

Answer: the index operator - `myVector[myCriteria]`

A few examples...

```{r}
# Create a vector containing only elements less than 5
a[a <= 5]
[1] 1 2 3 4 5

# Create a vector of alternate entries (remember short vectors are extended by repitition)
a[c(TRUE, FALSE)]
[1] 1 3 5 7 9
```

