---
title: "[KERNEL] Slab Allocator"
description: "※ Since the analysis was conducted with reference to the data, there may be errors. ※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action. ※ In the case of the image, I took the reference image I referenced because it has a good explanation. (It is at the bottom of the link.) In the User area, you can see malloc, free, etc."
date: "2024-11-14"
translation_key: "tistory-d01af56b9754"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Slab-Allocator"
private: false
---

**※ Since the analysis was conducted with reference to the data, there may be errors.** 

**※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action.**

**※ In the case of images, I took the reference image I referenced because it has a good explanation. (It is at the bottom of the link.)**

Memory allocation by functions such as malloc and free in the user area is managed by ptmalloc.

Kernel commands also require an allocator to efficiently manage memory, like ptmalloc in the user area, and this is a slab allocator.

* * *

There are three types of Slab Allocator: Slab Allocator, Slub Allocator, and Slob Allocator.

Slab Allocator

- Low efficiency due to very complex processing process
- user space \[ fastbin, unsorted bin etc \] ↔ kernel space \[full list, partial list, empty list \]
    - Managed entity: slab
- Slab objects contain metadata information
    - A lot of overhead occurs during the management process

Slub Allocaotr

- Allocator currently used by default
- Management using only partial list
- Improved memory locality compared to slab → reduced memory fragmentation
- Structure that optimizes the slab object → slub object

Slob Allocaotr

- Allocator mainly used in embedded Linux environments with small capacity
- Slow speed but low memory consumption

* * *

As mentioned earlier, Slab Allocator appeared for efficient memory management.

Let’s take a quick look at what process this takes and how it can be managed more efficiently than before.

![](/assets/images/tistory/tistory-d01af56b9754/001.png)

Let's assume that the page unit is 4K and look at a situation where a memory allocation of 128 bytes is requested.

If there is no Slab Allocator, one page of 4K size is used for 128 bytes.

![](/assets/images/tistory/tistory-d01af56b9754/002.png)

This not only uses memory resources very inefficiently, but also causes internal fragmentation problems.

- Internal fragmentation
    - If memory space is allocated by a memory allocation request, but the memory space used is small compared to the allocated space, and unused space remains, it is called \[internal fragmentation\].
    - This actually reduces the available memory space.

The technology that came out to solve this problem is Slab Allocator. 

![](/assets/images/tistory/tistory-d01af56b9754/003.png)

When allocating 4K space, Slab Allocator allocates the requested memory by splitting one space into one space rather than one space in one memory as before. This is similar to Kernel's Buddy System.

※ The Buddy System is basically used to solve external fragmentation problems, but the structure includes a Slab Allocator in the Buddy System. \[It is not a separate concept\]

* * *

In order to look at the simple flow of memory management, two concepts are needed.

- Slab Cache
    - The entity that secures and manages dynamic memory for frequently used structures in the kernel in advance.
-Slab Object
    - Process requests for predefined patterns
    - In the process of allocation and deallocation, a temporary wait is performed rather than an immediate return.
        - Prepare for reallocation and memory allocation requests of similar size

Frequently used patterns/structures are mentioned here, and we will look at the most representative ones.

When a process is created and running, a struct task\_struct type structure is used to contain pcb information.

At this time, if the process is repeatedly executed, overhead occurs because the structure must be requested and retrieved from memory each time it is executed. To achieve this, a method is used to allocate memory space for frequently used patterns in advance and provide it when a request is received.

![](/assets/images/tistory/tistory-d01af56b9754/004.png)

You can check this pattern by looking at /proc/slabinfo.

![](/assets/images/tistory/tistory-d01af56b9754/005.png)

You can confirm that the struct task\_struct mentioned earlier also exists.

![](/assets/images/tistory/tistory-d01af56b9754/006.png)

Now let's look at a simple flow.

![](/assets/images/tistory/tistory-d01af56b9754/007.png)

The structure is as shown in the picture above.

- Slab objects of the same size come together to form a slab page
- Slab Pages of different sizes come together to form a Slab Cache

![](/assets/images/tistory/tistory-d01af56b9754/008.png)

I brought a picture to show the exact structure.

In the case of cache, it is managed in two ways for each CPU and node.

- node
    - Since memory access speed is different for each node, pages are managed by node.
-cpu
    - Divide and manage memory by CPU for fast memory allocation
    - Pages related to allocation/release are managed in designated and partial lists

Although it is said to be divided into node and CPU, memory is managed efficiently by interacting with each other rather than managing them separately.

This can be confirmed by looking at memory allocation and deallocation, which will be discussed later.![](/assets/images/tistory/tistory-d01af56b9754/009.png)

**Freelist**

This refers to the beginning of a free object in a per-CPU page.

At this time, the free object has the form of a singly linked list that points to the next free object.

The efficiency of Slab Allocator is affected depending on how this freelist is managed and used.

```
struct page 
{
...
		struct 
		{	/* slab, slob and slub */
			union 
			{
				struct list_head slab_list;
				struct 
				{	/* Partial pages */
					struct page *next;
					#ifdef CONFIG_64BIT
						int pages;	/* Nr of pages left */
						int pobjects;	/* Approximate count */
					#else
						short int pages;
						short int pobjects;
					#endif
				};
			};
			struct kmem_cache *slab_cache; /* not slob */
			/* Double-word boundary */
			void *freelist;		/* first free object */
			union 
				{
					void *s_mem;	/* slab: first object */
					unsigned long counters;		/* SLUB */
					struct 
					{			/* SLUB */
						unsigned inuse:16;
						unsigned objects:15;
						unsigned frozen:1; // 뒤에서 설명함
					};
				};
			};
...
```

If you look at this code, you can see that the freelist is managed separately on the page.

- cpu->freelist
    - Directly managed by the current CPU
    - Objects can be allocated and deallocated
- cpu->page->freelist
    - Management when a CPU other than the current CPU releases an object managed by the current CPU
    - Objects that are not part of your CPU can only be released / cannot be allocated.

![](/assets/images/tistory/tistory-d01af56b9754/010.png)

As you can see from the picture above, when it is released by the current CPU, the inuse value of the page is maintained at 8. However, when it is released by another CPU, it is not managed by cpu->freelist and is managed by cpu->page->freelist, so you can see that the inuse is reduced by 2, making it 6.

* * *

There are five main memory allocation methods.

#### fastpath

- The fastest allocation method
- If there is an object that can be allocated in cpu->freelist, it is allocated immediately.
    - At this time, an object, not a page, is connected to cpu->freelist.

![](/assets/images/tistory/tistory-d01af56b9754/011.png)

#### Slowpath-1

- Executed when there are no objects available in cpu->freelist
- Upload objects in cpu->page->freelist to cpu->freelist and then perform fastpath

![](/assets/images/tistory/tistory-d01af56b9754/012.png)

![](/assets/images/tistory/tistory-d01af56b9754/013.png)

#### Slowpath-2

- When there is no object in cpu->page->freelist (situation where fastpath and slowpath-1 cannot be used)
- Utilize cpu->partial page
    - Move cpu->partial->page to cpu->page
    - Move moved objects to cpu->freelist
    - Afterwards perform fastpath

![](/assets/images/tistory/tistory-d01af56b9754/014.png)

#### Slowpath-3

- When there is no object that can be assigned to cpu->partial (a situation where fastpath, slowpath-1, and slowpath-2 cannot be used)

per-node utilization

- Move the first page in node->partial to cpu->page
- Objects move to cpu->freelist

![](/assets/images/tistory/tistory-d01af56b9754/015.png)

- Move part of the page in node->partial to cpu->partial
    - At this time, if node->partial is empty, use the partial of another node rather than the per-node cache.

![](/assets/images/tistory/tistory-d01af56b9754/016.png)

#### Slowpath-4

- Steps to use when all previous methods cannot be used
- New page allocation from Buddy System

![](/assets/images/tistory/tistory-d01af56b9754/017.png)

![](/assets/images/tistory/tistory-d01af56b9754/018.png)

The flow steps so far are as shown below.

![](/assets/images/tistory/tistory-d01af56b9754/019.png)

In the case of return, the structure is to return it to the place from which it was taken when allocating.

We won't cover all five, but will only look at fastpath.

![](/assets/images/tistory/tistory-d01af56b9754/020.png)

In the case of fastpath, since what is in cpu->freelist is immediately allocated, it is returned to that location as is.

* * *

#### Reference

- [http://jake.dothome.co.kr/slub/#comment-304534](http://jake.dothome.co.kr/slub/#comment-304534)

 [Slab Memory Allocator -1- (Structure)

<kernel v5.0> Slab Memory Allocator A slab (Slab, Slub, Slob) object is the minimum unit of regular memory allocation used by the kernel. The kernel is built and used by selecting one of the three options as follows. difference to each other

jake.dothome.co.kr](http://jake.dothome.co.kr/slub/#comment-304534)

- [https://jeongzero.oopy.io/132fed8f-5cfd-4f43-990c-61584744b4d0#8099faea-22d5-41e5-a168-3287129d4ed4](https://jeongzero.oopy.io/132fed8f-5cfd-4f43-990c-61584744b4d0#8099faea-22d5-41e5-a168-3287129d4ed4)

 [\[Linux Kernel\] What is Slab Memory Allocator?

Table of Contents

jeongzero.oopy.io](https://jeongzero.oopy.io/132fed8f-5cfd-4f43-990c-61584744b4d0#8099faea-22d5-41e5-a168-3287129d4ed4)