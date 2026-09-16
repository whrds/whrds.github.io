---
title: "[PWNABLE] Calling Convention"
description: "Stack Buffer OverFlow와 Return Address OverFlow를 진행하고 있는 지금 상황에서 크게 중요하지 않지만, 앞으로 포스팅을 진행하면서 rtl, rop, fsb 등과 같은 공격 기법들을 이해하기 위해서는 가장 기본이 되는 부분 중 하나이다. 리눅스의 함수 호출 규약은 크게 2종류로 나뉜다. ("
date: "2023-09-18"
translation_key: "tistory-7be1b58a1192"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention"
private: false
---

Stack Buffer OverFlow와 Return Address OverFlow를 진행하고 있는 지금 상황에서 크게 중요하지 않지만, 

앞으로 포스팅을 진행하면서 rtl, rop, fsb 등과 같은 공격 기법들을 이해하기 위해서는 가장 기본이 되는 부분 중 하나이다.

리눅스의 **함수 호출 규약**은 크게 2종류로 나뉜다. (2개만 있다는 것이 아니라 이 2종류가 기본이 된다는 것이다.)

x86환경에서는 레지스터를 사용하지 않고 Stack만을 이용하여 인자를 전달하는 cdecl 방식이 있다.

x86-64환경에서는 레지스터와 Stack 2개를 사용하여 인자를 전달하는 System V라는 호츌 규약이 있다.

### **x86**

레지스터를 활용하여 인자를 전달하기에는 그 수가 적기 때문에 Stack을 활용하는 함수 호출 규약을 주로 사용한다.

방식에 따라서 **cdecl, fastcall** 등이 있겠지만 가장 기본이 되는 cdecl을 다루겠다.

**cdecl 방식**도 간단한 예제를 만들어 확인을 해보도록 하겠다.

```
#include <stdio.h>

void func(int a, int b, int c){
    printf("%d \t %d \t %d", a,b,c);
}

int main(){
    func(9,5,1);
    return 0;
}
```

위 코드는 실행하면 9,5,1이라는 숫자를 차례대로 출력하는 코드이다.

main()에서 func()를 호출하는 시점에서 레지스터 혹은 Stack을 통해 인자를 전달하는데,

이제 이 과정을 확인해볼 것이다.

main()를 디버깅해서 func()의 호출 과정을 살펴보겠다.

![](/assets/images/tistory/tistory-7be1b58a1192/001.png)

func()이전에 push라는 어셈블리어를 통하여 Stack 1,5,9 순으로 값을 저장하고 있다.

Stack을 확인했을 때 인자가 정상적으로 들어간 것을 알 수 있다.

![](/assets/images/tistory/tistory-7be1b58a1192/002.png)

func()에서의 관점에서도 살펴보겠다.

![](/assets/images/tistory/tistory-7be1b58a1192/003.png)

printf()를 호출할 때 Stack에서 값을 가져온다.

![](/assets/images/tistory/tistory-7be1b58a1192/004.png)

체크한 부분이 func()의 Stack이다.

위 그림에서 0xffffd3f0을 보면 main()의 Stack Frame을 확인할 수 있다.

이런 방식으로 Stack을 사용하여 인자를 전달하는 것이 **cdecl 함수 호출 규약**이다.

### x86-64

x86과는 다르게 레지스터의 수가 충분하기 때문에 인자를 전달할 때 레지스터를 같이 사용한다.

이때 Stack이 아닌 레지스터를 우선으로 사용한다.

이유는 컴퓨터 구조를 보면 cpu에 메모리보다 레지스터가 더 가깝게 위치하고 있기 때문인 것으로 알고 있다.

여기서 다룰 호출규약은 **SYS V**이다.

특징으로는 인자를 다음과 같은 순서로 전달한다,

**rdi => rsi => rdx => rcx => r8 => r9 => stack**

```
#include <stdio.h>

void func(int a, int b, int c, int d, int e, int f, int g){
    printf("%d \t %d \t %d \t %d \t %d \t %d \t %d", a,b,c,d,e,f,g);
}

int main(){
    func(1,2,3,4,5,6,7);
    return 0;
}
```

간단하게 1~7를 출력하는 코드이다.

먼저 main()을 디버깅해서 먼저 살펴보겠다.

![](/assets/images/tistory/tistory-7be1b58a1192/005.png)

앞서 말했듯이 rdi, rsi, rdx, rcx, r8, r9, stack 순으로 인자를 전달하고 있다.

![](/assets/images/tistory/tistory-7be1b58a1192/006.png)

func()이 호출되기 직전의 레지스터 상태이다.

![](/assets/images/tistory/tistory-7be1b58a1192/007.png)

인자는 총 7개이기 때문에 마지막 인자는 stack에 들어있는 것을 알 수 있다.
