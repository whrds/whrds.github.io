---
title: "[PWNABLE] syscall"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ This is a concept used when performing the ROP technique that will be discussed next. Before proceeding, let me mention one thing about ROP: it is a technique used to bypass ASLR. When carrying out an attack, wouldn't it be enough to just find out the addresses of functions such as read, write, and system?"
date: "2023-11-08"
translation_key: "tistory-056f20fb92e1"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-syscall"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.**※

This is a concept used in performing the ROP technique that will be discussed next.

Before proceeding, let me mention one thing about ROP: it is a technique used to bypass ASLR.

One might think that in order to perform an attack, it would be sufficient to know the addresses of functions such as read, write, and system.

The answer is no!!

Although not all problems are of this type, there are some problems of this type, so it is important to be aware of them.

In situations where the functions such as read, write, and system are not implemented, it may be thought that we can perform an ROP attack by obtaining the addresses, similar to RTL_Chaining.

However, unlike RTL_Chaining, ROP is affected by ASLR, which causes the memory address to be referenced differently.

In such a situation, how can we get a shell?

For the read and write functions, it is possible to directly implement them using the assembly instruction syscall.

However, it is not possible to implement the system function. Fortunately, the execve function can be implemented!!

I will briefly look into the ways to implement each function.

A more detailed discussion will be done later when solving various ROP examples.

The assembly instruction syscall refers to the rax register.

I will give a few commonly used examples.

| func     | rax | rdi         | rsi           | rdx           |
|----------|-----|-------------|---------------|---------------|
| read     | 0x0 | fd          | generally 0   | address of buffer where input is stored |
|          |     |             |               | size of data to be input |
| write    | 0x1 | fd          | generally 1   | address of buffer where output data is stored |
|          |     |             |               | length of output data |
| rt_Sigreturn | 0xf | saves all register values at the moment the function is executed and performs context switching | - it's enough to just note this for now as it will be discussed later |
| execve   | 0x3b | string to be executed in the terminal | argv | envp |

If you want to find more information, you can refer to the following link.

[https://chromium.googlesource.com/chromiumos/docs/+/master/constants/syscalls.md](https://chromium.googlesource.com/chromiumos/docs/+/master/constants/syscalls.md)