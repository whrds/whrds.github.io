---
title: "[PWNABLE] syscall"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 다음에 다룰 ROP 기법을 수행하는데 있어서 사용되는 개념이다. 미리 ROP에 대해 한가지 적어두자면 ASLR을 우회하기 위해 사용하는 기법이다. 공격을 수행하는데 있어서 read, write, system 등 함수들의 주소만 알아내면 되지 않을까?"
date: "2023-11-08"
translation_key: "tistory-056f20fb92e1"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-syscall"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

다음에 다룰 ROP 기법을 수행하는데 있어서 사용되는 개념이다.

미리 ROP에 대해 한가지 적어두자면 ASLR을 우회하기 위해 사용하는 기법이다.

공격을 수행하는데 있어서 read, write, system 등 함수들의 주소만 알아내면 되지 않을까?라고 생각할 수도 있다.

답은 아니다!!

모든 문제들이 그런 것은 아니지만 이런 유형의 문제들이 좀 있기 때문에 알아둬야 한다.

read, write, system 등의 함수 자체가 구현이 안되어 있는 상황에서 ROP 공격을 수행해야 하는...

RTL\_Chaining 처럼 주소를 구해서 하면 되지 않을까?라고 생각할 수도 있다.

RTL\_Chaining과는 다르게 ROP는 ASLR로 인해 메모리가 참조되는 주소가 달라진다.

이런 상황에서 셸을 따기 위해서 어떻게 해야할까?

read와 write함수의 경우에는 syscall이라는 어셈블리어 명령어로 직접 구현이 가능하다.

하지만 system은 구현할 수가 없다.. 다행스럽게도 execve함수는 구현이 가능하다!!

각 함수들을 구현하는 방법에 대해서 간략하게 알아보겠다.

제대로 다루는 것은 후에 ROP의 각종 예제들을 풀어보면서....

어셈블리어 명령어인 syscall은 rax 레지스터를 참조한다.

자주 씌이는 몇가지 예를 들어보겠다.

func

rax

rdi

rsi

rdx

read

0x0

fd   
일반적으로 0

입력값을 저장할 버퍼의 주소

입력할 데이터 크기

write

0x1

fd  
일반적으로 1

출력할 데이터가 저장된 버퍼의 주소

출력할 데이터 길이

rt\_Sigreturn

0xf

함수가 실행되는 순간 모든 레지스터 값을 저장 후 컨텍스트 스위칭 수행  
\- 후에 다룰 내용이기 때문에 인지만 해둬도 된다.

execve

0x3b

터미널에서 실행할 문자열

argv

envp

이 외에도 추가적인 정보를 찾고자 하면 아래의 링크를 참고하면 된다.

[https://chromium.googlesource.com/chromiumos/docs/+/master/constants/syscalls.md](https://chromium.googlesource.com/chromiumos/docs/+/master/constants/syscalls.md)
