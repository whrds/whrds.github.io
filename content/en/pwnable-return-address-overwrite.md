---
title: "[PWNABLE]Return Address Overwrite"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ I briefly discussed Buffer OverFlow in the last post. This time, we will cover a technique that attacks the ret part located in the stack frame, which modifies the stack. Stack Frame basically has the above structure."
date: "2023-09-18"
translation_key: "tistory-465ad6c4abda"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLEReturn-Address-Overwrite"
private: false
---

**※ If there are any mistakes, please let me know. We will make corrections after confirmation.** **※** 

In the last post, I briefly discussed Buffer OverFlow.

This time, we will cover a technique that attacks the ret part located in the stack frame, which modifies the stack.

![](/assets/images/tistory/tistory-465ad6c4abda/001.png)

Stack Frame basically has the above structure.

What happens if you input data into buf and enter data larger than buf?

As long as it is a program without any special verification, input is possible by invading the sfp and ret areas.

An attack that follows this flow is **Return Address Overwrite**.

Let's create a simple example and practice it.

```
#include <stdio.h>

void getshell(){
    execve("/bin/sh",0,0);
}

int main(){
    int buf[0x30];
    
    printf("Input : ");
    read(0,buf,0x100);

    return 0;
}
```

The above code only performs the function of inputting values through read() in main().

There are two parts to pay attention to at this time.

1\. There is a function called getshell() that can run a shell.

2\. Looking at main(), you can enter a value larger than the declared 0x30 of the buf array.

```
int buf[0x30];
read(0,buf,0x100);
```

The above code is usually referred to as a ‘BOF vulnerability.’

Now, we will proceed with the exercise using the above code.

First you need to check the size of buf. 

When you just look at the code, you may think that it is generally 0x30,

An array called buf was created using the int data type, not char.

Therefore, 0xc0, which is the result of 4 \* 0x30 rather than 0x30, becomes the size of buf. 

Calculating through code like this is one way, but since we are studying the system, we will check again through gdb.

![](/assets/images/tistory/tistory-465ad6c4abda/002.png)

First of all, this is the part where the Stack Frame is created in main().

Since we already know the size of the buf, we can think of that part as the size/position of the buf.

Still, we have to check one more time.

In this example, there is one variable and Canary, one of the stack protection techniques, is set or

Since there is no need to align the stack, the stack frame and buf will match,

This is because there are more cases where this is not the case.

![](/assets/images/tistory/tistory-465ad6c4abda/003.png)

As a result of checking the part where read() was called, buf is also \[rbp-0xc0\].

![](/assets/images/tistory/tistory-465ad6c4abda/004.png)

The stack frame is summarized as above.

Looking at the vulnerability again, data of size 0x100, which is larger than 0xc0, which is the size of buf, is input through read().

Since the total size of the Stack Frame, including sfp and ret, is 0xd0, an attack is possible by overwriting even the ret part.

Now we just need to find out which function to use to ret, and we already know the answer.

This is because there is a function called getshell() that runs the shell.

The address of the function can be checked through gdb.

![](/assets/images/tistory/tistory-465ad6c4abda/005.png)

The attack procedure is summarized as follows.

1\. Find out the size of buf

2\. Check address of getshell()

3\. Send buf + sfp + ret (getshell function)

4\. attack success

```
from pwn import*

p = process('./return')
e = ELF('./return')

getshell = e.sym['getshell']

payload = b'a'*0xc0
payload += b'b'*0x8 
payload += p64(getshell)
p.send(payload)

p.interactive()
```

If you execute the above payload, you can confirm that the attack was performed normally.

![](/assets/images/tistory/tistory-465ad6c4abda/006.png)