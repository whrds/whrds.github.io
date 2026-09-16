---
title: "[PWNABLE] Heap Chunk Structure"
description: "Memory Allocator: Efficiently allocates limited memory resources to each process. - Dynamically allocates and frees memory during execution. - The type of algorithm used varies depending on the implementation. - ptmalloc2 is used in Ubuntu. A feature of ptmalloc2 is that it does not erase data on freed memory."
date: "2024-06-24"
translation_key: "tistory-c084fac95b4c"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Heap-Chunk-Structure"
private: false
---

Memory Allocator 

: Efficiently distributes limited memory resources to each process.

\- Dynamically allocates and frees memory during execution.

\- The type of algorithm used varies depending on the implementation - ptmalloc2 is used in Ubuntu.

A characteristic of ptmalloc2 is that it retains data in freed memory without erasing it.

It has the feature of being returned when a similar request is made.

\- Prevent memory waste

\- Fast memory reuse  
  Use a list called tcache or bin.

\- Memory fragmentation method  
  Use sorting, merging, and splitting to reduce fragmentation.

#### chunk

To the space allocated by ptmalloc 

It consists of header + data area.

Because the header indicates the status and size of the chunk, the structures of the chunk in use and the freed chunk are different.

![](/assets/images/tistory/tistory-c084fac95b4c/001.png)

If you look at the header of the freed chunk, fd and bk are present.

fd: Points to the next chunk in the linked list.

bk: Points to the previous chunk in the linked list.

![](/assets/images/tistory/tistory-c084fac95b4c/002.png)

allocated chunk

![](/assets/images/tistory/tistory-c084fac95b4c/003.png)

free chunk

#### bin

This is an object where used chunks are stored.

Because it is temporarily stored in the bin and used when an allocation request is made, it helps 'prevent memory waste and quickly reuse freed chunks.'

Bins are divided according to size.

- smallbin  
    Chunks with sizes ranging from 32 to 1024 bytes are stored.  
    The doubly linked list method and FIFO method are used.  
    Due to the nature of a doubly linked list, a disconnection process is required to add or release chunks.  
    This process is called unlink.  
    Since it is the merge target of ptmalloc, two adjacent chunks containing smallbin are merged.->consolidation
-fastbin  
    Chunks with sizes ranging from 32 to 176 bytes are stored.  
    There are 10 units of 16 bytes.  
    Because it is a single linked list method, the unlink process is unnecessary. => Increased speed
-largebin  
    Chunks with a size of 1024 bytes or more are stored.  
    All chunks with sizes within a certain range are stored.  
    When a reallocation request occurs, chunks of the most similar size are sorted in descending order to reallocate them.  
    It is a double connection method.
-unsortedbin  
    Stores unsorted chunks.  
    All chunks that exist only once and are not in fastbin are stored in unsortedbin when freed.  
    It is a doubly linked list method.

![](/assets/images/tistory/tistory-c084fac95b4c/004.png)

Efficiently manage the system using bin in arena.

It also supports optimization of the thread environment using tcache.

There are 64 tcache per thread, and each tcache has 7 chunks.

Therefore, there is no need to consider race conditions, and since it is used before the bin, it alleviates bottlenecks.  
And only chunks of the same size are stored in one tcache.