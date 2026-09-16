---
title: "[PWNABLE] plt & got"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ In the context of studying the system, you would have heard a lot about plt and got. plt holds data about got, and got holds data about the actual address of functions. You would have some understanding of this level. First, let's look at the concept. PLT (Procedure Linkage Table)"
date: "2023-10-04"
translation_key: "tistory-218fb7259047"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-plt-got"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※**

In the context of studying the system, you may have heard a lot about plt and got.

plt holds the data of got, and got holds data about the actual address of functions.

You probably know this much.

First, let's look at the concepts.

**PLT (Procedure Linkage Table)**: A table that connects external procedures, allowing the use of procedures in libraries.

**GOT (Global Offset Table)**: A table referenced by PLT, where the addresses of procedures are stored.

To understand these concepts, you need to know about static and dynamic linking.

**Linking**: The process of connecting a library containing the implementation code of various functions to a binary file.

* * *

In the **static** approach, plt and got are not needed.

Because the contents of the library are included in the file during creation, there is no need for additional linking methods when calling functions.

The disadvantages of this method are that if the contents of the shared library file are modified, the binary file cannot be linked, so it must be recompiled, and the file size itself becomes larger.

![](/assets/images/tistory/tistory-218fb7259047/001.png)

The **now binding** method is used in the static approach.

: A method where all symbol addresses are linked when the binary file starts.

* * *

The **dynamic** approach, unlike static, uses linking with shared libraries.

When the binary file is executed, the library is mapped into memory.

Linking occurs during the process of calling functions.

Because of this process, there is no need to recompile the library file even if it is modified.

![](/assets/images/tistory/tistory-218fb7259047/002.png)

The method used in the dynamic approach is **lazy binding**.

: A method where the address of the symbol is found and linked at the time the function is called.

Let's look at the lazy binding method.

![](/assets/images/tistory/tistory-218fb7259047/003.png)

By calling the function and tracing the flow using step into, you can access the above function.

We will examine the state of got before and after the execution of the _dl_runtime_resolve_xsavec function.

![](/assets/images/tistory/tistory-218fb7259047/004.png)

Before the call, a value other than the actual address of the function is present.

This is the state after the resolve function has been processed.

![](/assets/images/tistory/tistory-218fb7259047/005.png)

You can see that a different address is present.

This address is obtained by referencing the library file to get the actual address of the setvbuf function.

![](/assets/images/tistory/tistory-218fb7259047/006.png)

You can confirm that the obtained address is in the libc area.