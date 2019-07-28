---
title: Getting the order of matrix multiplication right
layout: post

tags: [hide-strapline]
---

I didn’t really get how the algebra of matrices connected to what they actually did until someone pointed out these little gems to me.

I owe a debt of gratitude to [Grant Sanderson of 3blue1brown](https://www.3blue1brown.com/) for presenting many of the ideas here in his excellent series of videos on linear algebra.

# The Problem

Assuming A and B are matrices, and v is a column-vector being transformed by them:

$$
\vec{v_2}=AB \vec{v_1}
$$

How do we read this?

1. v1 is transformed by B then A
2. v1 is transformed by A then B

This issue turns up in 3d computer graphics when applying projection and camera transformation. The correct order is to first apply the camera transformation and then apply the projection transformation. But how should be write that?

$$
(1) \ \vec{v_{result}} = Camera \times Projection \times \vec{v_{input}} \\
(2) \ \vec{v_{result}} = Projection \times Camera \times \vec{v_{input}}
$$


# How to read the order of operations

**Key idea: imaging we’re using function notation and start on the right and work left**

So, lets define a few things...

1. The inputs to a function are always defined as a column vector
2. Every linear transformation is specified by a matrix which has the same number of columns as there are rows in the vector we’re transforming

### The simplest case - a single function...

If you see this...

$$
\begin{pmatrix}
x_{result} \\
y_{result}
\end{pmatrix}
=
\begin{pmatrix} 
a & b\\
c & d\\
\end{pmatrix}
\begin{pmatrix} x_{input} \\ y_{input} \end{pmatrix}
$$

Read it like this...

$$
result = f(input)
$$

In words this means:

1. Post-multiply the column vector [x,y] with the matrix representing f
2. All done - the result will be a 2x1 column vector

This meets the requirement to be able to compose transformations because the output of the multiplication (which is the output of the transformation) is a column vector which could be the input to the  original transformation.

### A more complex case - one function after another...

We need a couple of definitions this time...

$$
f(x,y) = \begin{pmatrix} 
a & b\\
c & d
\end{pmatrix}
\
g(x,y) = \begin{pmatrix} 
j & k\\
l & m\\
\end{pmatrix}
$$

When you see...

$$
\begin{pmatrix} x_{result} \\ y_{result} \\ \end{pmatrix}
=
\begin{pmatrix} 
j & k\\
l & m\\
\end{pmatrix}
\begin{pmatrix} 
a & b\\
c & d\\
\end{pmatrix}
\begin{pmatrix} x_{input} \\ y_{input} \\  \end{pmatrix}
\\
$$

Read it like this...

$$
result = g(f(input))
$$

In words this means:

1. Post-multiply the column vector [x,y] with matrix representing f (*i.e. abcd*)
2. Post-multiply the result (another column vector) by the matrix representing g (*i.e. jklm*)
3. All done
