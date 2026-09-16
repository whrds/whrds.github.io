---
title: "[PWNABLE] NX bit"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ I should have posted this along with the BOF, but the order was a bit messed up;; No eXecute bit is an abbreviation for not granting execution rights to the stack area. For comparison, I compiled the same C file in two different ways. The non_ex file is in a state where the NX bit is disabled."
date: "2023-10-22"
translation_key: "tistory-14caa6c4e322"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-NX-bit"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※**

I should have posted this during the BOF, but the order was a bit messed up;;

It stands for No eXecute bit, which means not granting execution rights to the stack area.

![](/assets/images/tistory/tistory-14caa6c4e322/001.png)

For comparison, I compiled the same C file in two different ways.

The non_ex file is compiled with the NX bit disabled,

while the tomato file is compiled with it enabled.

First, let's look at the tomato file with the NX bit enabled.

![](/assets/images/tistory/tistory-14caa6c4e322/002.png)

Looking at the permissions for the stack section, we can see that the execution permission (x) is missing.

Next, let's look at the non_nx file.

![](/assets/images/tistory/tistory-14caa6c4e322/003.png)

We can see that the execution permission (x) is present.

At this point, what we can use in the stack area for attacks is

byte code such as shellcode.

However, if other strings that are not shellcode are also recognized as byte code,

the shellcode may not perform its normal functions properly.

To prevent this kind of situation, there is a technique called NOP Sled.

In assembly language, the function of NOP is to pass to the next instruction.

That is, if we patch NOPs before and after the shellcode, we can prevent

elements that may interfere with the execution of the shellcode.