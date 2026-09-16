---
title: "[PWNABLE] GOT Overwrite"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ This is an attack technique using plt&got that was previously written. https://whrdud727.tistory.com/15 [PWNABLE] plt & got ※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ This is in the context of studying the system."
date: "2023-10-04"
translation_key: "tistory-e0899e23fb45"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-GOT-Overwrite"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※**

This is an attack technique using plt&got that was previously written.

[https://whrdud727.tistory.com/15](https://whrdud727.tistory.com/15)

 [PWNABLE] plt & got

※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ If you are studying the system, you may have heard a lot about plt and got. plt holds data from got, and got holds function

whrdud727.tistory.com](https://whrdud727.tistory.com/15)

In the dynamic method, we looked at how the actual address is linked when calling a function due to the lazy binding method.

When linking is done normally, it points in the order of plt => got => actual address.

At this time, overwriting the data that got points to with another function's address is called GOT Overwrite.

I will check this with a simple example.

```
#include <stdio.h>

int main(void)
{
        char buf[20];

        gets(buf);
        puts(buf);

        return 0;
}
```

This is a code that outputs the value input through the gets function directly to the puts function.

I will try to execute /bin/sh using the above code.

From the perspective that it outputs the input value as is, it is possible to think that entering /bin/sh would be the way to go.

But how about the functions such as system or execve that will execute the shell, which are passed as arguments?

The answer is to overwrite the got of puts function with the address of the system function.

Looking at the functions in the above code, you can see that there are gets@plt and puts@plt as follows.

![](/assets/images/tistory/tistory-e0899e23fb45/001.png)

What we need to know is got, but you might wonder why we check plt first.

As mentioned several times, plt holds data from got.

In other words, by disassembling the corresponding plt, you can obtain got.

![](/assets/images/tistory/tistory-e0899e23fb45/002.png)

Using puts@plt = 0x08049060, we obtained puts@got = 0x804c008.

Now we need to find the address of the system function, but there is no declaration of the system function in the code.

In that case, we need to target after the file is executed and the shared library is linked.

After linking, you can search in gdb and reference the shared library, so you can get the actual address of the system function.

![](/assets/images/tistory/tistory-e0899e23fb45/003.png)

Now I will set puts@got to system@add.

![](/assets/images/tistory/tistory-e0899e23fb45/004.png)

You can overwrite the value using the set command.

After doing this, by entering only '/bin/sh' in the input of gets, you can see that the shell is executed.

![](/assets/images/tistory/tistory-e0899e23fb45/005.png)

In actual CTF or similar environments, you cannot use this method.

In such situations, you need to use techniques such as rtl, rop, etc., to build a chain to perform got overwrite.

In other words, got overwrite is often used in techniques that will be discussed later, so it is important to understand and move on.